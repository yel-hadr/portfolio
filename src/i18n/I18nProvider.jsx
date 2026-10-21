import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LANGS, dictionaries } from './dictionaries';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { I18nContext } from './context';

const STORAGE_KEY = 'lang';
// How long the page content fades out before the text swaps (see .lang-switching in index.css)
const FADE_MS = 160;

const lookup = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict);

// '{name}' placeholders -> values
const interpolate = (text, vars) =>
  vars
    ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match))
    : text;

// The inline script in index.html already chose the language (saved choice, else the browser's)
const initialLang = () => {
  const lang = document.documentElement.lang;
  return LANGS.includes(lang) ? lang : 'en';
};

/**
 * Language state for the whole site. `t('works.items.iot.name')` returns the string (or array)
 * for the current language, falling back to English, then to the key itself. Switching fades
 * the page content out and back in, and tells the waves background to ripple.
 */
const I18nProvider = ({ children }) => {
  const [lang, setLangState] = useState(initialLang);
  const reduced = usePrefersReducedMotion();
  // During the fade the requested language is pending; a second click (FR then EN quickly)
  // retargets the same switch instead of being ignored or starting another one
  const pending = useRef(null);
  const timer = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    document.title = lookup(dictionaries[lang], 'meta.title');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', lookup(dictionaries[lang], 'meta.description'));
  }, [lang]);

  const setLang = useCallback(
    (next) => {
      if (!LANGS.includes(next) || next === (pending.current ?? lang)) return;
      // Saved only when the visitor chooses, so the browser language keeps deciding otherwise
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage can be unavailable (private mode); the choice then lasts for this visit only
      }
      if (reduced) {
        setLangState(next);
        return;
      }
      if (pending.current === null) {
        window.dispatchEvent(new CustomEvent('site:langchange', { detail: next }));
      }
      pending.current = next;
      const root = document.documentElement;
      root.classList.add('lang-switching');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setLangState(pending.current);
        pending.current = null;
        // Fade back in after React has painted the new text
        requestAnimationFrame(() =>
          requestAnimationFrame(() => root.classList.remove('lang-switching'))
        );
      }, FADE_MS);
    },
    [lang, reduced]
  );

  const t = useCallback(
    (key, vars) => {
      const value = lookup(dictionaries[lang], key) ?? lookup(dictionaries.en, key);
      if (value === undefined) return key;
      return typeof value === 'string' ? interpolate(value, vars) : value;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export default I18nProvider;
