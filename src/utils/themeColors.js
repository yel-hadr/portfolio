// Theme colors for canvas and three.js code, which cannot use Tailwind classes. The tokens are
// CSS variables holding "R G B" channels (src/index.css), so they follow the theme.

/** { name: 'R G B' } for each `--c-<name>` token */
export const readTheme = (names) => {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map((n) => [n, css.getPropertyValue(`--c-${n}`).trim()]));
};

/** 'R G B' channels (and an optional alpha) as a CSS color */
export const rgb = (channels, alpha = 1) => `rgb(${channels} / ${alpha})`;
