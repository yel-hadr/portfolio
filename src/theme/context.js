import { createContext, useContext } from 'react';

export const ThemeContext = createContext(null);

/** { theme: 'dark' | 'light', setTheme, toggleTheme } (see ThemeProvider) */
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};
