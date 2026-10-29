import { StrictMode, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted Poppins (latin subset, font-display: swap): no render-blocking third-party
// stylesheet before the first paint. Only the weights the design uses.
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-900.css';
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
