// One JSON dictionary per area and language. Feature components own their namespace file.
// core, status and til ship with the page. The terminal and diagram namespaces are large
// (about 300 keys) and only needed once those lazy components open, so their modules register
// them with registerNamespace() when they load (see Terminal.jsx and ArchitectureModal.jsx).
import enCore from '../locales/en/core.json';
import enStatus from '../locales/en/status.json';
import enTil from '../locales/en/til.json';
import frCore from '../locales/fr/core.json';
import frStatus from '../locales/fr/status.json';
import frTil from '../locales/fr/til.json';

export const LANGS = ['en', 'fr'];

export const dictionaries = {
  en: { ...enCore, status: enStatus, til: enTil },
  fr: { ...frCore, status: frStatus, til: frTil },
};

/**
 * Add a namespace from a lazily loaded module, e.g. registerNamespace('terminal', { en, fr }).
 * t() reads `dictionaries` on every call, so the strings are available as soon as the module
 * that registers them has been evaluated, before its components render.
 */
export const registerNamespace = (name, byLang) => {
  LANGS.forEach((lang) => {
    dictionaries[lang][name] = byLang[lang];
  });
};
