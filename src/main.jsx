import { StrictMode, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted Geist (UI) and JetBrains Mono (code), latin subset, font-display: swap: no
// render-blocking third-party stylesheet before the first paint. Only the weights the design uses
import '@fontsource/geist/latin-400.css';
import '@fontsource/geist/latin-500.css';
import '@fontsource/geist/latin-600.css';
import '@fontsource/geist/latin-700.css';
import '@fontsource/geist/latin-900.css';
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
