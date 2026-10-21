import { useEffect, useState } from 'react';

// Public, unauthenticated GitHub REST API (60 requests per hour per IP). Each load costs 2-3
// requests, and results are cached per tab for 10 minutes.
const API = 'https://api.github.com';
const OWNER = 'yel-hadr';
const REPO = `${OWNER}/portfolio`;
const RUNS_URL = `${API}/repos/${REPO}/actions/workflows/deploy.yml/runs?branch=main&per_page=10`;
const EVENTS_URL = `${API}/users/${OWNER}/events/public?per_page=30`;

export const ACTIONS_URL = `https://github.com/${REPO}/actions`;

const CACHE_KEY = 'github-status:v1';
const CACHE_TTL = 10 * 60 * 1000;
const COMMIT_COUNT = 3;
const MESSAGE_MAX = 80;

// Runs that deploy main
const DEPLOY_EVENTS = ['push', 'workflow_dispatch'];
const FAILED = ['failure', 'timed_out', 'startup_failure', 'action_required'];

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const BRANCH_RE = /^[\w./-]+$/;

/** Only GitHub links are ever rendered, whatever the API returns. */
export const isGithubUrl = (url) =>
  typeof url === 'string' && url.startsWith('https://github.com/');

const readCache = () => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (cached && Date.now() < cached.until) return cached.data;
  } catch {
    // Storage blocked or corrupt: fetch again
  }
  return null;
};

const writeCache = (data, ttl = CACHE_TTL) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ until: Date.now() + ttl, data }));
  } catch {
    // Storage full or blocked: the next visit fetches again
  }
};

const getJson = async (url, signal) => {
  const res = await fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) {
    const error = new Error(`GitHub API ${res.status}`);
    // Unauthenticated rate limit: remember when it resets, so reloads don't keep hitting it
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      error.retryAt = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    }
    throw error;
  }
  return res.json();
};

const firstLine = (message) => {
  const line = String(message ?? '')
    .split('\n')[0]
    .trim();
  return line.length > MESSAGE_MAX ? `${line.slice(0, MESSAGE_MAX - 1).trimEnd()}…` : line;
};

/** The newest run that deployed main; pull_request runs only check. */
const latestDeploy = (json) =>
  (Array.isArray(json?.workflow_runs) ? json.workflow_runs : [])
    .filter((run) => DEPLOY_EVENTS.includes(run?.event) && run?.head_branch === 'main')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;

/**
 * Badge state from the latest deploy run. Never "success" unless the latest *completed* run
 * succeeded; a run still going shows as deploying.
 */
const parseRuns = (latest) => {
  if (!latest) return null;

  const toRun = (run, state, time) => ({
    state,
    url: isGithubUrl(run.html_url) ? run.html_url : ACTIONS_URL,
    time: Number.isFinite(Date.parse(time)) ? time : null,
  });

  if (latest.status !== 'completed') {
    return toRun(latest, 'deploying', latest.run_started_at || latest.created_at);
  }
  const { conclusion } = latest;
  const state =
    conclusion === 'success'
      ? 'operational'
      : FAILED.includes(conclusion)
        ? 'failed'
        : 'incomplete';
  return toRun(latest, state, latest.updated_at);
};

const toCommit = (repo, sha, message) => {
  if (!REPO_RE.test(repo ?? '') || !SHA_RE.test(sha ?? '')) return null;
  const url = `https://github.com/${repo}/commit/${sha}`;
  return isGithubUrl(url) ? { repo, sha: sha.slice(0, 7), message: firstLine(message), url } : null;
};

// Branch name of a push ref ("refs/heads/main" -> "main"); null for tags and odd values
const branchOf = (ref) => {
  const branch = String(ref ?? '').replace(/^refs\/heads\//, '');
  return branch !== ref && BRANCH_RE.test(branch) ? branch : null;
};

const listCommits = async (repo, ref, signal) => {
  const query = ref ? `&sha=${encodeURIComponent(ref)}` : '';
  const list = await getJson(
    `${API}/repos/${repo}/commits?per_page=${COMMIT_COUNT}${query}`,
    signal
  );
  return (Array.isArray(list) ? list : [])
    .map((c) => toCommit(repo, c?.sha, c?.commit?.message))
    .filter(Boolean)
    .slice(0, COMMIT_COUNT);
};

/**
 * Latest commits from public push events. The events feed lags behind pushes by minutes, so when
 * the latest deploy run of this site is newer than the newest push in the feed, list this repo's
 * default branch instead. The feed also often truncates PushEvent payloads (no `commits`, only
 * `head`), so otherwise list the tip of the pushed branch, which is never older than the push.
 */
const loadCommits = async (signal, deployed) => {
  const [events, deploy] = await Promise.all([getJson(EVENTS_URL, signal), deployed]);
  const pushes = (Array.isArray(events) ? events : [])
    .filter((e) => e?.type === 'PushEvent' && REPO_RE.test(e.repo?.name ?? ''))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const push = pushes[0];

  // No public push, or the feed has not caught up with the push that triggered the latest deploy
  // (a run is created seconds after its push, so this also covers that push itself: same branch)
  const lagging =
    deploy?.event === 'push' && Date.parse(deploy.created_at) > Date.parse(push?.created_at);
  if (!push || lagging) {
    return listCommits(REPO, null, signal);
  }

  const fromPayloads = pushes
    .flatMap((e) =>
      (Array.isArray(e.payload?.commits) ? e.payload.commits : [])
        .slice()
        .reverse() // payload lists oldest first
        .map((c) => toCommit(e.repo.name, c?.sha, c?.message))
    )
    .filter(Boolean);
  if (fromPayloads.length) return fromPayloads.slice(0, COMMIT_COUNT);

  const branch = branchOf(push.payload?.ref);
  const head = SHA_RE.test(push.payload?.head ?? '') ? push.payload.head : null;
  return listCommits(push.repo.name, branch ?? head, signal);
};

/**
 * Deploy status and recent commits from GitHub, fetched only once `ref` comes near the viewport.
 * Returns { status: 'idle' | 'loading' | 'ready' | 'error', run, commits }. Never throws:
 * failures (offline, rate limit, odd payloads) end in 'error' or a partial result.
 */
export const useGithubStatus = (ref) => {
  const [result, setResult] = useState(() => {
    const cached = readCache();
    if (!cached) return { status: 'idle', run: null, commits: [] };
    return { status: cached.limited ? 'error' : 'ready', run: cached.run, commits: cached.commits };
  });
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (result.status !== 'idle' || near || !el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, near, result.status]);

  useEffect(() => {
    // `near` only turns true while idle (a cached result never observes)
    if (!near) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    setResult((prev) => ({ ...prev, status: 'loading' }));

    const deploy = getJson(RUNS_URL, signal).then(latestDeploy);
    // Commits only use the deploy run to detect a lagging events feed: without it, carry on
    const commitsLoad = loadCommits(
      signal,
      deploy.catch(() => null)
    );
    Promise.allSettled([deploy.then(parseRuns), commitsLoad]).then(([runs, commits]) => {
      if (signal.aborted) return;
      const run = runs.status === 'fulfilled' ? runs.value : null;
      const list = commits.status === 'fulfilled' ? commits.value : [];
      if (!run && !list.length) {
        const retryAt = [runs, commits].find((r) => r.reason?.retryAt > 0)?.reason.retryAt;
        if (retryAt) {
          const wait = Math.min(Math.max(retryAt - Date.now(), 60 * 1000), CACHE_TTL);
          writeCache({ limited: true, run: null, commits: [] }, wait);
        }
        setResult({ status: 'error', run: null, commits: [] });
        return;
      }
      // Cache only complete answers, so a transient failure is retried on the next load
      if (runs.status === 'fulfilled' && commits.status === 'fulfilled') {
        writeCache({ run, commits: list });
      }
      setResult({ status: 'ready', run, commits: list });
    });
    return () => controller.abort();
  }, [near]);

  return result;
};

export default useGithubStatus;
