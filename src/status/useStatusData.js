import { useEffect, useState } from 'react';

import config from '../../status.config.json';
import {
  pipelineBase,
  pipelineError,
  pipelineResult,
  runsOf,
  runsPath,
  summarizeRuns,
} from '../../scripts/status/lib.mjs';

// The monitor publishes these next to the site (scripts/status/check.mjs)
const BASE = import.meta.env.BASE_URL;
// GitHub Pages answers with Access-Control-Allow-Origin: *, so dev and previews can read the
// published data before (or without) a local copy
const LIVE = 'https://yel-hadr.github.io/';
const REFRESH_MS = 5 * 60 * 1000;

const LIVE_CACHE_KEY = 'status-page:live-ci:v1';
const LIVE_CACHE_TTL = 10 * 60 * 1000;

const validSummary = (v) =>
  v?.schemaVersion === 1 &&
  Number.isFinite(Date.parse(v.generatedAt)) &&
  ['operational', 'degraded', 'outage'].includes(v.overall) &&
  Array.isArray(v.monitors) &&
  Array.isArray(v.pipelines);

// null for anything but a JSON answer: the dev server answers unknown paths with index.html
const getJson = async (url, signal) => {
  try {
    const res = await fetch(url, {
      signal,
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok || !String(res.headers.get('content-type')).includes('json')) return null;
    return await res.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return null;
  }
};

const loadPublished = async (signal) => {
  const bases = window.location.origin === new URL(LIVE).origin ? [BASE] : [BASE, LIVE];
  for (const base of bases) {
    const summary = await getJson(`${base}status.json`, signal);
    if (validSummary(summary)) {
      const history = await getJson(`${base}status/history.json`, signal);
      const samples =
        history?.schemaVersion === 1 && Array.isArray(history.samples) ? history.samples : null;
      return { summary, samples, remote: base === LIVE };
    }
  }
  return null;
};

const readCache = () => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(LIVE_CACHE_KEY));
    if (cached && Date.now() < cached.until) return cached.pipelines;
  } catch {
    // Storage blocked or corrupt: fetch again
  }
  return null;
};

const writeCache = (pipelines) => {
  try {
    sessionStorage.setItem(
      LIVE_CACHE_KEY,
      JSON.stringify({ until: Date.now() + LIVE_CACHE_TTL, pipelines })
    );
  } catch {
    // Storage full or blocked: the next visit fetches again
  }
};

/**
 * Before the monitor has published anything: the pipelines read live from the public GitHub API
 * (unauthenticated, 60 requests per hour per IP, one request per pipeline, cached 10 minutes).
 */
const loadLivePipelines = async (signal) => {
  const cached = readCache();
  if (cached) return cached;
  const pipelines = await Promise.all(
    (config.pipelines ?? []).map(async (pipeline) => {
      const base = pipelineBase(pipeline);
      try {
        const res = await fetch(`https://api.github.com${runsPath(pipeline, 30)}`, {
          signal,
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) return pipelineError(base, `HTTP ${res.status}`);
        const runs = runsOf(await res.json(), pipeline);
        return pipelineResult(base, runs, summarizeRuns(runs));
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        return pipelineError(base, 'network');
      }
    })
  );
  if (pipelines.every((p) => !p.error)) writeCache(pipelines);
  return pipelines;
};

/**
 * The status data: { phase: 'loading' } first, then { phase: 'ready', summary, samples, remote }
 * from the published JSON, or { phase: 'none', pipelines } when nothing was published yet.
 * Refreshes every 5 minutes; a failed refresh keeps the data on screen (its age shows).
 */
export const useStatusData = () => {
  const [data, setData] = useState({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let timer = 0;

    const load = async (first) => {
      try {
        const published = await loadPublished(signal);
        if (published) {
          setData({ phase: 'ready', ...published });
        } else if (first) {
          setData({ phase: 'none', pipelines: await loadLivePipelines(signal) });
        }
      } catch {
        // Aborted on unmount
      }
      if (!signal.aborted) timer = window.setTimeout(() => load(false), REFRESH_MS);
    };
    load(true);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return data;
};

/** The monitors and servers from the config, for listing them before any data exists */
export const configuredMonitors = [
  ...(config.monitors ?? []).map((m) => ({ ...m, kind: 'http' })),
  ...(config.servers ?? []).map((m) => ({ ...m, kind: 'server' })),
];
