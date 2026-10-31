import { createContext, useContext } from 'react';

export const I18nContext = createContext(null);

/** { lang, setLang, t } for the current language (see I18nProvider) */
export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
};

/**
 * A project tag's label: product names (`name`) as written, techniques (`id`) from the locale,
 * `works.tags.<id>`, since French names them differently. Here rather than in a module of its
 * own, which Rollup would make a separate tiny chunk (Works and the terminal both use it)
 */
export const tagName = (t, tag) => (tag.id ? t(`works.tags.${tag.id}`) : tag.name);
