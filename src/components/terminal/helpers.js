// Text helpers for the terminal: accent- and case-insensitive matching, typo suggestions and
// tab completion. Pure functions, no React.

/** 'Compétences' -> 'competences', so French words match with or without accents */
export const normalize = (word) => word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Levenshtein edit distance (words here are short, so the plain O(n*m) table is fine)
const distance = (a, b) => {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
};

/** The closest word, when the input looks like an obvious typo of it; otherwise null */
export const closest = (word, candidates) => {
  const input = normalize(word);
  const limit = input.length <= 3 ? 1 : 2;
  let best = null;
  let bestDistance = limit + 1;
  candidates.forEach((candidate) => {
    const d = distance(input, normalize(candidate));
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  });
  return best;
};

const commonPrefix = (words) =>
  words.reduce((prefix, word) => {
    let i = 0;
    while (i < prefix.length && i < word.length && prefix[i] === word[i]) i += 1;
    return prefix.slice(0, i);
  });

/**
 * Completes the last word of `value` from `candidates`. Returns the new value (a unique match
 * gets a trailing space, several matches their common prefix) and the matching candidates.
 */
export const completeWord = (value, candidates) => {
  const [, head, partial] = value.match(/^(.*?)(\S*)$/s);
  const typed = normalize(partial);
  const matches = [...new Set(candidates.filter((c) => normalize(c).startsWith(typed)))];
  if (matches.length === 0) return { value, matches };
  if (matches.length === 1) return { value: `${head}${matches[0]} `, matches };
  const prefix = commonPrefix(matches);
  return { value: prefix.length > partial.length ? `${head}${prefix}` : value, matches };
};
