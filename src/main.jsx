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
