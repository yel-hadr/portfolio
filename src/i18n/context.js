import { createContext, useContext } from 'react';

export const I18nContext = createContext(null);

/** { lang, setLang, t } for the current language (see I18nProvider) */
export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
};
