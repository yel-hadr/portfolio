import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { ThemeContext } from './context';

const STORAGE_KEY = 'theme';
// The inline script in index.html set data-theme before the first paint (saved choice, else
// dark, the site's default look), so React starts from what is already on screen.
const initialTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

/**
 * Dark/light theme. Colors are CSS variables keyed on <html data-theme>, so switching is one
 * attribute change; the waves background watches the attribute and recolors itself.
 */
const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(initialTheme);
  const reduced = usePrefersReducedMotion();
  const fadeTimer = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // The browser's bars take the page's own background token (as the blog pages do), so no hex
    // here can drift from the theme
    const channels = getComputedStyle(root).getPropertyValue('--c-background').trim();
    if (channels) {
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', `rgb(${channels.split(/\s+/).join(', ')})`);
    }
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
  }, [theme]);

  const setTheme = useCallback(
    (next) => {
      if (next !== 'light' && next !== 'dark') return;
      const root = document.documentElement;
      if (!reduced) {
        // Cross-fade colors for this one switch only (not on every hover)
        // One cross-fade window, restarted by each toggle (a quick second toggle keeps it)
        root.classList.add('theme-transition');
        window.clearTimeout(fadeTimer.current);
        fadeTimer.current = window.setTimeout(() => root.classList.remove('theme-transition'), 400);
      }
      setThemeState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage unavailable: the choice lasts for this visit only
      }
    },
    [reduced]
  );

  const toggleTheme = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme]
  );

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
