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
// (the terminal, a demo, Game Mode). Reload once to pick up the new build; the timestamp guard
// stops a loop when the chunk is missing for another reason, and the import then rejects into the
// nearest error boundary as before. Offline, no reload: it would swap the page for the browser's
// offline page, where the boundary keeps everything already loaded
window.addEventListener('vite:preloadError', (event) => {
  if (!navigator.onLine) return;
  const KEY = 'chunk-reload-at';
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY)) || 0;
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return; // Storage blocked: no loop guard, so no reload
  }
  event.preventDefault();
  window.location.reload();
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
