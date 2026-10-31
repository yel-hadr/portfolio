// Client entry of the generated blog pages (build/blog.js). The pages are complete without it;
// this adds the styles and fonts, the theme toggle, the saved language choice and copy buttons.
// Plain JavaScript: no React on these pages.
// Self-hosted Geist and JetBrains Mono, the same subset and weights as src/main.jsx
import '@fontsource-variable/geist/wght.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '../index.css';
import './blog.css';

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let strings = {};
try {
  strings = JSON.parse(document.getElementById('blog-strings')?.textContent ?? '{}');
} catch {
  // Malformed strings: the buttons below fall back to empty labels and stay usable
}
const fill = (text = '', vars = {}) =>
  text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));

const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page only
  }
};

// Theme toggle -------------------------------------------------------------------------------

const themeButton = document.querySelector('[data-theme-toggle]');
let fadeTimer = 0;

const showTheme = (theme) => {
  root.dataset.theme = theme;
  // The browser UI color follows the page background token, as ThemeProvider does
  const channels = getComputedStyle(root).getPropertyValue('--c-background').trim();
  if (channels) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${channels})`);
  }
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
  // The label says what the button does next
  const label = theme === 'dark' ? strings.themeToLight : strings.themeToDark;
  themeButton?.setAttribute('aria-label', label);
  themeButton?.setAttribute('title', label);
};

if (themeButton) {
  showTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
  themeButton.hidden = false;
  themeButton.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    if (!reducedMotion.matches) {
      // Cross-fade colors for this one switch (see .theme-transition in index.css)
      root.classList.add('theme-transition');
      window.clearTimeout(fadeTimer);
      fadeTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 400);
    }
    showTheme(next);
    save('theme', next);
  });
}

// Language switch: the links work on their own; picking one also becomes the site's language,
// so the portfolio opens in it too (same 'lang' key as I18nProvider)
document.querySelectorAll('[data-lang-link]').forEach((link) => {
  link.addEventListener('click', () => save('lang', link.dataset.langLink));
});

// Copy buttons on code blocks ----------------------------------------------------------------

const COPY_ICON =
  '<svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>';

const addCopyButton = (block) => {
  const head = block.querySelector('.code-head');
  const code = block.querySelector('code');
  if (!head || !code) return;

  // The live region exists before any message, so screen readers announce the first one
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.className = 'code-status';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy';
  button.innerHTML = COPY_ICON;
  const visible = document.createElement('span');
  visible.textContent = strings.copy ?? '';
  const extra = document.createElement('span');
  extra.className = 'sr-only';
  extra.textContent = fill(strings.copySr, { n: block.dataset.code ?? '' });
  button.append(visible, extra);

  let timer = 0;
  let attempts = 0;
  button.addEventListener('click', async () => {
    const attempt = ++attempts;
    window.clearTimeout(timer);
    // Clearing first makes a repeated result count as a change for screen readers
    status.textContent = '';
    let outcome = 'copied';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(code.textContent ?? '');
    } catch {
      // No permission or no secure context: select the code so the keyboard copy still works
      outcome = 'failed';
      window.getSelection()?.selectAllChildren(code);
    }
    // Let the empty region reach the accessibility tree before the new message
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    // A newer click owns the status region now
    if (attempt !== attempts) return;
    status.textContent = outcome === 'copied' ? strings.copied : strings.copyFailed;
    status.classList.toggle('is-error', outcome === 'failed');
    timer = window.setTimeout(
      () => {
        status.textContent = '';
      },
      outcome === 'copied' ? 2500 : 8000
    );
  });

  head.append(status, button);
};

document.querySelectorAll('.code-block').forEach(addCopyButton);

// Dev only: a post, posts.js or the strings changed, so the server renders a new page
if (import.meta.hot) {
  import.meta.hot.on('blog:update', () => window.location.reload());
}
