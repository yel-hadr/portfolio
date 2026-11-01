// Best scores of the mini-games, kept in localStorage (keys in constans: gameStorage). Storage
// can be missing or blocked (private mode, disabled site data), so every access is guarded and
// the games still work, just without remembering.

/** The saved best score, or 0 */
export const readBest = (key) => {
  try {
    const value = Number.parseInt(window.localStorage.getItem(key) ?? '', 10);
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

/** Saves `ms` if it is faster than the saved best time (lower is better); as `saveBest` */
export const saveFastest = (key, ms) => {
  const value = Math.max(1, Math.round(ms));
  const previous = readBest(key);
  if (previous && value >= previous) return { best: previous, newBest: false };
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Not saved; the time still counts for this visit
  }
  return { best: value, newBest: true };
};

/** Saves `score` if it beats the saved best; returns the best after the update and whether it did */
export const saveBest = (key, score) => {
  const previous = readBest(key);
  if (score <= previous) return { best: previous, newBest: false };
  try {
    window.localStorage.setItem(key, String(score));
  } catch {
    // Not saved; the score still counts for this visit
  }
  return { best: score, newBest: true };
};
