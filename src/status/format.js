// Locale-aware formatting for the status page (Intl, so French gets "99,5 %" and "1,8 s").

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;
// Older summaries get a warning: the monitor runs every 30 minutes
export const STALE_MS = 2 * HOUR;

const UNITS = [
  ['day', DAY / 1000],
  ['hour', HOUR / 1000],
  ['minute', 60],
];

/** "12 minutes ago" / "il y a 12 minutes"; `justNow` under a minute. Clamped to the past. */
export const relativeTime = (iso, lang, now, justNow) => {
  const seconds = Math.min(0, (Date.parse(iso) - now) / 1000);
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? [];
  if (!unit) return justNow;
  return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(
    Math.round(seconds / size),
    unit
  );
};

export const dateTime = (iso, lang) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export const shortDay = (ms, lang) =>
  new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric' }).format(new Date(ms));

/** 477 ms, 1.8 s */
export const formatMs = (ms, lang) => {
  if (!Number.isFinite(ms)) return '–';
  if (ms < 1000) return `${new Intl.NumberFormat(lang).format(Math.round(ms))} ms`;
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(ms / 1000)} s`;
};

/** 100 %, 99.31 %, 75 %: rounded down, so 99.999 % never shows as 100 % */
export const formatPct = (ratio, lang) => {
  if (!Number.isFinite(ratio)) return '–';
  const value = Math.floor(ratio * 10000) / 10000;
  return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 2 }).format(value);
};

/** 41 s, 2 min 5 s, 1 h 3 min (the same abbreviations in English and French) */
export const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return '–';
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
};

/** Nearest-rank percentile; null when empty. */
export const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length))) - 1];
};

/** Points of one monitor from the history samples since `from`: { t, ok, ms, code }. */
export const seriesOf = (samples, id, from = 0) =>
  (samples ?? [])
    .map((s) => ({ t: Date.parse(s.t), r: s.m?.[id] }))
    .filter(({ t, r }) => r && t >= from)
    .map(({ t, r }) => ({
      t,
      ok: r.ok === 1,
      ms: Number.isFinite(r.ms) ? r.ms : null,
      code: r.code,
    }));

/** count, median, p95, max of the successful points and the number of failed ones */
export const statsOf = (points) => {
  const values = points.filter((p) => p.ok && p.ms !== null).map((p) => p.ms);
  return {
    count: points.length,
    failed: points.filter((p) => !p.ok).length,
    median: percentile(values, 50),
    p95: percentile(values, 95),
    max: values.length ? Math.max(...values) : null,
    uptime: points.length ? points.filter((p) => p.ok).length / points.length : null,
  };
};

/** Start of the visitor's local day, `daysAgo` days back */
export const dayStart = (now, daysAgo = 0) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
};

/** Only links to GitHub are rendered from data that came over the network */
export const isGithubUrl = (url) =>
  typeof url === 'string' && url.startsWith('https://github.com/');

export const isHttpUrl = (url) => typeof url === 'string' && /^https?:\/\//.test(url);

/** Translated name of a known monitor or pipeline; the config's name for the owner's own ones */
export const displayName = (t, item) => {
  const key = `statuspage.names.${item.id}`;
  const value = t(key);
  return value === key ? (item.name ?? item.id) : value;
};
