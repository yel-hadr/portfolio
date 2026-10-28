// One-off backfill for Grafana: replays the published monitor history (up to 7 days) and the
// current pipeline state as Influx lines, so a new Grafana dashboard starts with real data
// instead of empty panels. Safe to re-run: the same series and timestamps overwrite themselves.
//
// Usage: node scripts/status/grafana-backfill.mjs [--history <file|url>] [--summary <file|url>]
//                                                 [--dry-run]
// Env:   GRAFANA_INFLUX_URL, GRAFANA_INFLUX_USER, GRAFANA_INFLUX_TOKEN (as for check.mjs)
// In CI: Actions -> "Status monitor" -> Run workflow with "Backfill Grafana" ticked.
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { historyInfluxLines, influxLines, writeInflux } from './lib.mjs';

const SITE = 'https://yel-hadr.github.io';
const BATCH = 5000;

const { values: args } = parseArgs({
  options: {
    history: { type: 'string', default: `${SITE}/status/history.json` },
    summary: { type: 'string', default: `${SITE}/status.json` },
    'dry-run': { type: 'boolean', default: false },
  },
});

const load = async (source) => {
  if (/^https?:\/\//.test(source)) {
    // Cache-busting query: GitHub Pages caches these files for 10 minutes
    const res = await fetch(`${source}?backfill=${Date.now()}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
    return res.json();
  }
  return JSON.parse(await readFile(source, 'utf8'));
};

const main = async () => {
  const [history, summary] = await Promise.all([load(args.history), load(args.summary)]);
  const samples = Array.isArray(history.samples) ? history.samples : [];
  const kinds = Object.fromEntries(summary.monitors.map((m) => [m.id, m.kind]));
  const lines = [
    historyInfluxLines(samples, kinds),
    influxLines(summary, Date.parse(summary.generatedAt)),
  ]
    .filter(Boolean)
    .join('\n')
    .split('\n');

  console.log(
    `${samples.length} history samples (${samples[0]?.t ?? '-'} to ${samples.at(-1)?.t ?? '-'}), ` +
      `${lines.length} lines`
  );
  if (args['dry-run']) {
    console.log(lines.slice(0, 5).join('\n'));
    return;
  }

  const target = {
    url: process.env.GRAFANA_INFLUX_URL,
    user: process.env.GRAFANA_INFLUX_USER,
    token: process.env.GRAFANA_INFLUX_TOKEN,
    userAgent: 'yel-hadr-status-backfill (+https://yel-hadr.github.io/status/)',
  };
  for (let i = 0; i < lines.length; i += BATCH) {
    const result = await writeInflux(target, lines.slice(i, i + BATCH).join('\n'));
    if (result === 'off') {
      throw new Error('Set GRAFANA_INFLUX_URL, GRAFANA_INFLUX_USER and GRAFANA_INFLUX_TOKEN.');
    }
    if (result === 'failed') throw new Error(`Batch ${i / BATCH + 1} was rejected.`);
  }
  console.log('Backfill written.');
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
