import { StrictMode, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted Geist (UI; the variable font, one file for every weight) and JetBrains Mono (code),
// latin subset, font-display: swap: no render-blocking third-party stylesheet before the first
// paint. JetBrains Mono: only the weights the design uses
import '@fontsource-variable/geist/wght.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './index.css';
import App from './App.jsx';

// A deploy replaces every hashed chunk, so a tab opened before it 404s on its next lazy import
// (the terminal, a demo, Game Mode). The failed import still rejects into its dialog's error
// boundary, which closes the dialog, says so and can load it again (useRetryLazy). Then a HEAD
// request asks whether the file is still there: gone (404) means a newer build, so the page
// reloads once to pick it up; there, or no answer, means the network blinked, and the page stays
// as it is (no lost form draft or Game Mode run). The timestamp guard stops a reload loop
const FAILED_URL = /https?:\/\/[^\s'"]+|\/[^\s'"]+\.(?:js|css)\b/;
const reloadForNewBuild = () => {
  const KEY = 'chunk-reload-at';
  try {
    const last = Number(sessionStorage.getItem(KEY)) || 0;
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return; // Storage blocked: no loop guard, so no reload
  }
  window.location.reload();
};
window.addEventListener('vite:preloadError', (event) => {
  if (!navigator.onLine) return;
  const url = String(event.payload?.message ?? '').match(FAILED_URL)?.[0];
  if (!url) return;
  fetch(url, { method: 'HEAD', cache: 'no-store' })
    .then((response) => {
      if (response.status === 404) reloadForNewBuild();
    })
    .catch(() => {});
});

// The first render as a transition: React 19 renders it in slices and yields to the browser
// between them, instead of one long task that blocks input while the page boots
const root = createRoot(document.getElementById('root'));
startTransition(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
