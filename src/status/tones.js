// State -> tone -> token classes. Text colors meet AA on the page and the glass cards in both
// themes (success, primary-400, danger and foreground-muted are the site's checked text tokens);
// every state also has an icon and a word, so color is never the only cue.
export const TONE_TEXT = {
  good: 'text-success',
  warn: 'text-primary-400',
  bad: 'text-danger',
  neutral: 'text-foreground-muted',
};

export const OVERALL_TONE = {
  operational: 'good',
  degraded: 'warn',
  outage: 'bad',
  unknown: 'neutral',
};

export const MONITOR_TONE = { up: 'good', slow: 'warn', down: 'bad', none: 'neutral' };

export const PIPELINE_TONE = { passing: 'good', failing: 'bad', unknown: 'neutral' };

/** Daily uptime cells: full, partial, mostly down */
export const uptimeTone = (ratio) => {
  if (!Number.isFinite(ratio)) return 'neutral';
  if (ratio >= 1) return 'good';
  return ratio >= 0.9 ? 'warn' : 'bad';
};
