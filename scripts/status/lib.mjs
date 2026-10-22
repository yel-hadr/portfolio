// Pure helpers of the status monitor (no I/O), kept apart from check.mjs so they are easy to
// reason about and to try in isolation.

export const SCHEMA_VERSION = 1;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// Conclusions that count as a failed pipeline run. cancelled, skipped, neutral and stale runs say
// nothing about the pipeline's health, so they are left out of the state and the success rate.
export const FAILED_CONCLUSIONS = ['failure', 'timed_out', 'startup_failure', 'action_required'];

export const slugify = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Monitors and servers from the config, with the defaults filled in. Throws on a bad entry. */
export const normalizeTargets = (config) => {
  const defaults = config.defaults ?? {};
  const entries = [
    ...(config.monitors ?? []).map((entry) => ({ kind: 'http', ...entry })),
    ...(config.servers ?? []).map((entry) => ({ kind: 'server', ...entry })),
  ];
  const seen = new Set();
  return entries.map((entry) => {
    const id = entry.id ?? slugify(entry.name);
    const url = new URL(entry.url); // throws on a malformed URL: a config bug
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`Monitor ${id}: only http(s) URLs can be checked`);
    }
    if (!id || seen.has(id)) throw new Error(`Monitor ids must be unique and non-empty: "${id}"`);
    seen.add(id);
    return {
      id,
      kind: entry.kind,
      name: entry.name ?? id,
      url: url.href,
      method: (entry.method ?? defaults.method ?? 'GET').toUpperCase(),
      expectStatus: entry.expectStatus ?? defaults.expectStatus ?? 200,
      timeoutMs: entry.timeoutMs ?? defaults.timeoutMs ?? 10000,
      slowMs: entry.slowMs ?? defaults.slowMs ?? 3000,
      critical: entry.critical === true,
    };
  });
};

/** True when `status` matches expectStatus: a number, a list, or a "2xx"-style class. */
export const statusMatches = (status, expect) => {
  if (Array.isArray(expect)) return expect.some((e) => statusMatches(status, e));
  if (typeof expect === 'string' && /^[1-5]xx$/i.test(expect)) {
    return Math.floor(status / 100) === Number(expect[0]);
  }
  return status === Number(expect);
};

/** Nearest-rank percentile (p in 0..100) of a list of numbers; null when empty. */
export const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
};

const isSample = (s) =>
  s && typeof s === 'object' && Number.isFinite(Date.parse(s.t)) && s.m && typeof s.m === 'object';

/**
 * A history document from a parsed JSON value. Anything that is not a version-1 history (an HTML
 * error page, a newer schema) is rejected so it is never merged.
 */
export const parseHistory = (value) => {
  if (!value || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.samples)) {
    return null;
  }
  return value.samples.filter(isSample);
};

/** Previous samples plus this one, oldest first, without samples older than the retention. */
export const mergeHistory = (previous, sample, retentionDays, now) => {
  const cutoff = now - retentionDays * DAY;
  return [...previous, sample]
    .filter((s) => Date.parse(s.t) >= cutoff)
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
};

/** Uptime (0..1) and sample count of one monitor over the last `ms`; uptime null when no data. */
export const uptime = (samples, id, ms, now) => {
  const results = samples
    .filter((s) => Date.parse(s.t) >= now - ms)
    .map((s) => s.m[id])
    .filter(Boolean);
  if (!results.length) return { ratio: null, samples: 0 };
  const up = results.filter((r) => r.ok === 1).length;
  return { ratio: Number((up / results.length).toFixed(4)), samples: results.length };
};

/** p50 and p95 latency of the successful checks of one monitor over the last 24 hours. */
export const latencyStats = (samples, id, now) => {
  const values = samples
    .filter((s) => Date.parse(s.t) >= now - DAY)
    .map((s) => s.m[id])
    .filter((r) => r && r.ok === 1 && Number.isFinite(r.ms))
    .map((r) => r.ms);
  return { p50: percentile(values, 50), p95: percentile(values, 95), samples: values.length };
};

export const WINDOWS = { '24h': DAY, '7d': 7 * DAY };

/** Monitor state from one check result. */
export const monitorState = (result, target) => {
  if (!result.ok) return 'down';
  return result.latencyMs > target.slowMs ? 'slow' : 'up';
};

/**
 * Pipeline health from its runs (newest first). The state comes from the latest run that ended
 * with a decisive conclusion (success or a failure); a run still going is reported separately.
 */
export const summarizeRuns = (runs) => {
  const completed = runs.filter((r) => r.status === 'completed').slice(0, 20);
  const decisive = completed.filter(
    (r) => r.conclusion === 'success' || FAILED_CONCLUSIONS.includes(r.conclusion)
  );
  const succeeded = decisive.filter((r) => r.conclusion === 'success').length;
  const lastDecisive = decisive[0] ?? null;
  const state = !lastDecisive
    ? 'unknown'
    : lastDecisive.conclusion === 'success'
      ? 'passing'
      : 'failing';
  return {
    state,
    lastDecisive,
    lastSuccess: runs.find((r) => r.conclusion === 'success') ?? null,
    successRate: {
      window: completed.length,
      decisive: decisive.length,
      succeeded,
      rate: decisive.length ? Number((succeeded / decisive.length).toFixed(4)) : null,
    },
  };
};

/**
 * Overall status, with the reasons behind it (empty when operational):
 * - outage: a critical monitor is down;
 * - degraded: any other monitor is down, any monitor is slow, or a pipeline that affects the
 *   overall status (affectsOverall) failed its latest decisive run or could not be read;
 * - operational: everything else.
 */
export const overallStatus = (monitors, pipelines) => {
  const reasons = [];
  monitors.forEach((m) => {
    if (m.state === 'down') reasons.push({ type: 'monitor', id: m.id, reason: 'down' });
    if (m.state === 'slow') reasons.push({ type: 'monitor', id: m.id, reason: 'slow' });
  });
  pipelines
    .filter((p) => p.affectsOverall && (p.state === 'failing' || p.state === 'unknown'))
    .forEach((p) => reasons.push({ type: 'pipeline', id: p.id, reason: p.state }));

  const outage = monitors.some((m) => m.critical && m.state === 'down');
  return { overall: outage ? 'outage' : reasons.length ? 'degraded' : 'operational', reasons };
};

// Influx line protocol: tag values escape commas, spaces and equals signs
const tag = (value) => String(value).replace(/[,= ]/g, (c) => `\\${c}`);

/** Grafana Cloud (Influx write endpoint) lines for one run; metric names: <measurement>_<field>. */
export const influxLines = (summary, timeMs) => {
  const ns = `${BigInt(timeMs) * 1000000n}`;
  const lines = summary.monitors.map((m) => {
    const fields = [`up=${m.ok ? 1 : 0}i`, `status_code=${m.statusCode ?? 0}i`];
    if (Number.isFinite(m.latencyMs)) fields.push(`latency_ms=${m.latencyMs}i`);
    return `status_http,monitor=${tag(m.id)},kind=${tag(m.kind)} ${fields.join(',')} ${ns}`;
  });
  summary.pipelines.forEach((p) => {
    const fields = [`passing=${p.state === 'passing' ? 1 : 0}i`];
    if (p.successRate.rate !== null) fields.push(`success_rate=${p.successRate.rate}`);
    const duration = p.lastCompletedRun?.durationSeconds;
    if (Number.isFinite(duration)) fields.push(`duration_seconds=${duration}i`);
    lines.push(`status_pipeline,pipeline=${tag(p.id)} ${fields.join(',')} ${ns}`);
  });
  const level = { operational: 0, degraded: 1, outage: 2 }[summary.overall];
  lines.push(`status_overall level=${level}i ${ns}`);
  return lines.join('\n');
};

/** The public fields of a GitHub Actions run (null in, null out). */
export const runInfo = (run) => {
  if (!run) return null;
  const started = Date.parse(run.run_started_at || run.created_at);
  const ended = Date.parse(run.updated_at);
  return {
    id: run.id,
    number: run.run_number,
    title: String(run.display_title ?? '').slice(0, 120),
    event: run.event,
    branch: run.head_branch,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    headSha: run.head_sha,
    createdAt: run.created_at,
    startedAt: run.run_started_at ?? null,
    updatedAt: run.updated_at,
    // Wall-clock time of the run (start to its last update), only once it has finished
    durationSeconds:
      run.status === 'completed' && ended >= started ? Math.round((ended - started) / 1000) : null,
  };
};

/** One pipeline entry of status.json, from its runs (newest first) and summarizeRuns(). */
export const pipelineResult = (base, runs, summary, lastSuccess = summary.lastSuccess) => {
  const latest = runs[0] ?? null;
  return {
    ...base,
    state: summary.state,
    inProgress: Boolean(latest && latest.status !== 'completed'),
    latestRun: runInfo(latest),
    lastCompletedRun: runInfo(summary.lastDecisive),
    lastSuccessAt: lastSuccess?.updated_at ?? null,
    successRate: summary.successRate,
    error: null,
  };
};

/** A pipeline whose runs could not be read */
export const pipelineError = (base, error) => ({
  ...base,
  state: 'unknown',
  inProgress: false,
  latestRun: null,
  lastCompletedRun: null,
  lastSuccessAt: null,
  successRate: { window: 0, decisive: 0, succeeded: 0, rate: null },
  error,
});

/** Fields of a pipeline entry that come from the config */
export const pipelineBase = (pipeline) => ({
  id: pipeline.id,
  name: pipeline.name,
  repo: pipeline.repo,
  workflow: pipeline.workflow,
  branch: pipeline.branch ?? null,
  affectsOverall: pipeline.affectsOverall !== false,
  url: `https://github.com/${pipeline.repo}/actions`,
});

/**
 * The workflow-runs query of a pipeline (the API lists runs newest first).
 * exclude_pull_requests only empties each run's `pull_requests` array to keep the response small:
 * runs triggered by pull requests are still returned. What leaves them out is the `branch` filter
 * here (a pull request run's head branch is the pull request's own branch) and, where a pipeline
 * sets one, its `events` list in runsOf().
 */
export const runsPath = (pipeline, perPage = 50) => {
  const query = new URLSearchParams({ per_page: String(perPage), exclude_pull_requests: 'true' });
  if (pipeline.branch) query.set('branch', pipeline.branch);
  return `/repos/${pipeline.repo}/actions/workflows/${encodeURIComponent(pipeline.workflow)}/runs?${query}`;
};

/** Runs from a workflow-runs response, newest first, limited to the pipeline's events */
export const runsOf = (json, pipeline) =>
  (Array.isArray(json?.workflow_runs) ? json.workflow_runs : [])
    .filter((r) => !pipeline.events || pipeline.events.includes(r.event))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
