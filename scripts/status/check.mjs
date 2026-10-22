#!/usr/bin/env node
// Status monitor (Node 20+, no dependencies). GitHub Pages only serves static files, so the
// checks run in GitHub Actions (.github/workflows/status.yml, every 30 minutes) and publish two
// static JSON files next to the site:
//   <out>/status.json          the summary endpoint (https://yel-hadr.github.io/status.json)
//   <out>/status/history.json  7 days of samples, read back on the next run to compute uptime
//
// Usage: node scripts/status/check.mjs [--out <dir>] [--config <file>] [--history <file|url>]
// Env:   GITHUB_TOKEN (optional, raises the GitHub API rate limit)
//        GRAFANA_INFLUX_URL, GRAFANA_INFLUX_USER, GRAFANA_INFLUX_TOKEN (optional Grafana Cloud push)
//
// Monitors being down is data, not an error: the script exits 0 and the files say so. It exits
// non-zero only on a bug or a broken config.
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  SCHEMA_VERSION,
  WINDOWS,
  influxLines,
  latencyStats,
  mergeHistory,
  monitorState,
  normalizeTargets,
  overallStatus,
  parseHistory,
  pipelineBase,
  pipelineError,
  pipelineResult,
  runsOf,
  runsPath,
  statusMatches,
  summarizeRuns,
  uptime,
} from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const USER_AGENT = 'yel-hadr-status-monitor (+https://yel-hadr.github.io/status/)';
const GITHUB_API = 'https://api.github.com';
// The published history is read from the branch Pages serves (no CDN lag right after a run),
// then from the live site.
const PAGES_REPO = 'yel-hadr/yel-hadr.github.io';
const HISTORY_PATH = 'status/history.json';

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: resolve(ROOT, 'out') },
    config: { type: 'string', default: resolve(ROOT, 'status.config.json') },
    history: { type: 'string' },
  },
});

const token = process.env.GITHUB_TOKEN || '';
const githubHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': USER_AGENT,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// Short, secret-free error text for the published JSON
const describeError = (error) => {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  const cause = error?.cause?.code || error?.cause?.message;
  return String(cause || error?.message || 'error').slice(0, 120);
};

/** One HTTP check: latency is the time to the response headers (the body is not timed). */
const checkOnce = async (target) => {
  const headers = { 'User-Agent': USER_AGENT };
  // The GitHub API rate-limits unauthenticated calls per IP, and Actions runners share IPs; the
  // token is sent to api.github.com only, never to another host.
  if (token && new URL(target.url).hostname === 'api.github.com') {
    headers.Authorization = `Bearer ${token}`;
  }
  const started = performance.now();
  try {
    const res = await fetch(target.url, {
      method: target.method,
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(target.timeoutMs),
    });
    const latencyMs = Math.round(performance.now() - started);
    await res.body?.cancel().catch(() => {});
    const ok = statusMatches(res.status, target.expectStatus);
    return { ok, statusCode: res.status, latencyMs, error: ok ? null : `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, statusCode: null, latencyMs: null, error: describeError(error) };
  }
};

/** A failed check is retried once after 2 s, so one dropped packet is not reported as down. */
const check = async (target) => {
  const first = await checkOnce(target);
  if (first.ok) return { ...first, attempts: 1 };
  await sleep(2000);
  return { ...(await checkOnce(target)), attempts: 2 };
};

/** GitHub REST call; a network error or a 5xx is retried once, a 4xx is final. */
const githubJson = async (path, attempt = 1) => {
  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: githubHeaders,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const error = new Error(`GitHub API HTTP ${res.status}`);
      error.final = res.status < 500;
      throw error;
    }
    return await res.json();
  } catch (error) {
    if (error.final || attempt >= 2) throw error;
    await sleep(2000);
    return githubJson(path, attempt + 1);
  }
};

const checkPipeline = async (pipeline) => {
  const base = pipelineBase(pipeline);
  try {
    const runs = runsOf(await githubJson(runsPath(pipeline)), pipeline);
    const summary = summarizeRuns(runs);
    let lastSuccess = summary.lastSuccess;
    if (!lastSuccess && runs.length) {
      // Older than the 50 runs above: ask for the newest successful one directly
      const older = await githubJson(`${runsPath(pipeline, 20)}&status=success`);
      lastSuccess = runsOf(older, pipeline)[0];
    }
    return pipelineResult(base, runs, summary, lastSuccess);
  } catch (error) {
    return pipelineError(base, describeError(error));
  }
};

const fetchJson = async (url, headers = {}) => {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) return { missing: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { value: await res.json() };
};

/**
 * Previous samples: { samples, source } when read (or when none was ever published), or
 * { samples: null } when it could not be read; the caller then does not overwrite it.
 */
const loadHistory = async () => {
  if (args.history && !/^https?:\/\//.test(args.history)) {
    try {
      const value = JSON.parse(await readFile(resolve(args.history), 'utf8'));
      return { samples: parseHistory(value) ?? [], source: 'file' };
    } catch (error) {
      if (error.code === 'ENOENT') return { samples: [], source: 'new' };
      throw error; // a local file given on purpose must be readable
    }
  }

  const sources = args.history
    ? [[args.history]]
    : [
        [
          `${GITHUB_API}/repos/${PAGES_REPO}/contents/${HISTORY_PATH}?ref=main`,
          { ...githubHeaders, Accept: 'application/vnd.github.raw+json' },
        ],
        [`https://yel-hadr.github.io/${HISTORY_PATH}?ts=${Date.now()}`],
      ];
  let missing = 0;
  for (const [url, headers] of sources) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await fetchJson(url, headers);
        if (result.missing) {
          missing += 1;
          break;
        }
        const samples = parseHistory(result.value);
        if (samples) return { samples, source: new URL(url).host };
        // Not a version-1 history (corrupt or hand-edited): replaced by a fresh one
        console.warn(`History at ${new URL(url).host} is not a version ${SCHEMA_VERSION} file`);
        missing += 1;
        break;
      } catch (error) {
        console.warn(`History from ${new URL(url).host}: ${describeError(error)} (try ${attempt})`);
        if (attempt < 3) await sleep(2000 * attempt);
      }
    }
  }
  // Every source said 404 or held no valid history: this run starts a new one
  if (missing === sources.length) return { samples: [], source: 'new' };
  return { samples: null, source: 'unavailable' };
};

const pushToGrafana = async (summary, timeMs) => {
  const { GRAFANA_INFLUX_URL: url, GRAFANA_INFLUX_USER: user } = process.env;
  const secret = process.env.GRAFANA_INFLUX_TOKEN;
  if (!url || !user || !secret) return 'off';
  try {
    // Accept the full write URL or just the host of the Grafana Cloud Influx endpoint
    const endpoint = new URL(url);
    if (endpoint.pathname === '/' || endpoint.pathname === '') {
      endpoint.pathname = '/api/v1/push/influx/write';
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'User-Agent': USER_AGENT,
        Authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`,
      },
      body: influxLines(summary, timeMs),
      signal: AbortSignal.timeout(15000),
    });
    await res.body?.cancel().catch(() => {});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'ok';
  } catch (error) {
    // Optional extra: never fails the run (and never echoes the URL or the credentials)
    console.warn(`Grafana Cloud push failed: ${describeError(error)}`);
    return 'failed';
  }
};

const stepSummary = async (summary) => {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = [
    `### Status: ${summary.overall}`,
    '',
    '| Check | State | Detail |',
    '| --- | --- | --- |',
    ...summary.monitors.map(
      (m) => `| ${m.name} | ${m.state} | ${m.statusCode ?? m.error ?? ''} ${m.latencyMs ?? ''} ms |`
    ),
    ...summary.pipelines.map(
      (p) => `| ${p.name} (${p.repo}) | ${p.state} | ${p.lastCompletedRun?.conclusion ?? ''} |`
    ),
    '',
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, rows.join('\n'));
};

const main = async () => {
  const config = JSON.parse(await readFile(resolve(args.config), 'utf8'));
  const targets = normalizeTargets(config);
  const pipelinesConfig = config.pipelines ?? [];
  const retentionDays = config.retentionDays ?? 7;
  const site = config.site ?? 'https://yel-hadr.github.io';

  const [history, results, pipelines] = await Promise.all([
    loadHistory(),
    Promise.all(targets.map(check)),
    Promise.all(pipelinesConfig.map(checkPipeline)),
  ]);
  const now = Date.now();
  const generatedAt = new Date(now).toISOString();

  // One sample: { t, m: { <monitor id>: { ok: 1 | 0, ms, code } } }
  const sample = {
    t: generatedAt,
    m: Object.fromEntries(
      targets.map((target, i) => [
        target.id,
        { ok: results[i].ok ? 1 : 0, ms: results[i].latencyMs, code: results[i].statusCode },
      ])
    ),
  };
  const samples = mergeHistory(history.samples ?? [], sample, retentionDays, now);
  // Without the previous history, the windows would hold this one sample only (a single check
  // would read as 100 % uptime and its latency as p50 and p95): publish no figure rather than a
  // misleading one. The page shows null as a dash and says the history was not loaded.
  const historyLoaded = history.samples !== null;
  const windowUptime = (id, ms) =>
    historyLoaded ? uptime(samples, id, ms, now) : { ratio: null, samples: 0 };
  const windowLatency = (id) =>
    historyLoaded ? latencyStats(samples, id, now) : { p50: null, p95: null, samples: 0 };

  const monitors = targets.map((target, i) => {
    const result = results[i];
    return {
      id: target.id,
      name: target.name,
      kind: target.kind,
      url: target.url,
      method: target.method,
      critical: target.critical,
      state: monitorState(result, target),
      ok: result.ok,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      slowMs: target.slowMs,
      attempts: result.attempts,
      error: result.error,
      checkedAt: generatedAt,
      uptime: Object.fromEntries(
        Object.entries(WINDOWS).map(([name, ms]) => [name, windowUptime(target.id, ms)])
      ),
      latency24h: windowLatency(target.id),
    };
  });

  const { overall, reasons } = overallStatus(monitors, pipelines);
  const summary = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    overall,
    reasons,
    rules: {
      outage: 'a critical monitor is down',
      degraded:
        'another monitor is down, a monitor is slower than its slowMs, or a pipeline that affects the overall status failed its latest decisive run or could not be read',
      operational: 'none of the above',
    },
    interval: { minutes: config.intervalMinutes ?? 30, retentionDays },
    // samples: the size of the published history, or null when it could not be read this run
    history: { loaded: historyLoaded, samples: historyLoaded ? samples.length : null },
    monitors,
    pipelines,
    links: {
      page: `${site}/status/`,
      summary: `${site}/status.json`,
      history: `${site}/${HISTORY_PATH}`,
      source: 'https://github.com/yel-hadr/portfolio/blob/main/scripts/status/check.mjs',
      workflow: 'https://github.com/yel-hadr/portfolio/actions/workflows/status.yml',
    },
  };

  const outDir = resolve(args.out);
  await mkdir(resolve(outDir, 'status'), { recursive: true });
  await writeFile(resolve(outDir, 'status.json'), `${JSON.stringify(summary, null, 2)}\n`);
  if (historyLoaded) {
    const doc = { schemaVersion: SCHEMA_VERSION, generatedAt, retentionDays, samples };
    await writeFile(resolve(outDir, HISTORY_PATH), `${JSON.stringify(doc)}\n`);
  } else {
    // Not overwritten: publishing only this sample would erase the published days
    console.warn('Previous history unavailable: status/history.json is not written this run');
  }

  const grafana = await pushToGrafana(summary, now);
  await stepSummary(summary);

  console.log(
    `Overall: ${overall} (${generatedAt}), history: ${history.source}, ${samples.length} samples, grafana: ${grafana}`
  );
  monitors.forEach((m) =>
    console.log(
      `  ${m.state.padEnd(5)} ${m.id} ${m.statusCode ?? m.error} ${m.latencyMs ?? '-'} ms`
    )
  );
  pipelines.forEach((p) =>
    console.log(`  ${p.state.padEnd(7)} ${p.id} ${p.lastCompletedRun?.url ?? p.error ?? ''}`)
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
