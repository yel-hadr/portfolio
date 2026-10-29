// Theme colors for canvas and three.js code, which cannot use Tailwind classes. The tokens are
// CSS variables holding "R G B" channels (src/index.css), so they follow the theme.

/** { name: 'R G B' } for each `--c-<name>` token, as the page has them (or as `el` has them: a
 * .scheme-dark island takes the dark values in either theme) */
export const readTheme = (names, el = document.documentElement) => {
  const css = getComputedStyle(el);
  return Object.fromEntries(names.map((n) => [n, css.getPropertyValue(`--c-${n}`).trim()]));
};

/** 'R G B' channels (and an optional alpha) as a CSS color */
export const rgb = (channels, alpha = 1) => `rgb(${channels} / ${alpha})`;
