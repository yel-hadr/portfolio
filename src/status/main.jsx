// The /status/ page: a small React entry of its own (status/index.html), sharing the site's theme,
// i18n and tokens but none of the portfolio's sections or 3D code.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist/latin-400.css';
import '@fontsource/geist/latin-500.css';
import '@fontsource/geist/latin-600.css';
import '@fontsource/geist/latin-700.css';
import '@fontsource/geist/latin-900.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '../index.css';

import en from '../locales/en/statuspage.json';
import fr from '../locales/fr/statuspage.json';
import { registerNamespace } from '../i18n/dictionaries';
import I18nProvider from '../i18n/I18nProvider';
import ThemeProvider from '../theme/ThemeProvider';
import StatusApp from './StatusApp';

registerNamespace('statuspage', { en, fr });
// I18nProvider sets the title and meta description from meta.*: this page's own, not the
// portfolio's (this bundle never runs on the portfolio page)
registerNamespace('meta', { en: en.meta, fr: fr.meta });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <StatusApp />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);
