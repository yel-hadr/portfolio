import { lazy, useState } from 'react';

// The failed module's URL, as Chromium ("Failed to fetch dynamically imported module: <url>")
// and Firefox ("error loading dynamically imported module: <url>") word the error
const FAILED_URL = /https?:\/\/[^\s'"]+/;
// The URL with a query of its own (any earlier retry's replaced), so the browser fetches it anew
const fresh = (url) => {
  const base = url.replace(/([?&])retry=\d+&?/, '$1').replace(/[?&]$/, '');
  return `${base}${base.includes('?') ? '&' : '?'}retry=${Date.now()}`;
};
// Module-level: the React Compiler does not compile a hook holding a dynamic import()
const importFresh = (url) => import(/* @vite-ignore */ fresh(url));

// A lazy component that notes the URL its import failed on, for the retry
const attempt = (load) => {
  const failed = { url: null };
  const Component = lazy(() =>
    load().catch((error) => {
      failed.url = String(error?.message ?? '').match(FAILED_URL)?.[0] ?? null;
      throw error;
    })
  );
  return { Component, failed };
};

/**
 * A lazy component that can be made again. React.lazy keeps a rejected import for good, so after
 * one failed load (offline, a flaky network) the dialog it holds would never open again, even
 * with the network back. `retry()` swaps in a fresh lazy component. The browser keeps a failed
 * module fetch for the page's lifetime too, so the retry asks for that URL with a query of its
 * own (a new fetch); where the error names no URL (Safari), it runs the loader again. Call it from
 * the error boundary that caught the failure.
 * @returns {[React.ComponentType, () => void]}
 */
export const useRetryLazy = (loader) => {
  const [current, setCurrent] = useState(() => attempt(loader));
  const retry = () =>
    setCurrent((prev) => {
      const { url } = prev.failed;
      return attempt(url ? () => importFresh(url) : loader);
    });
  return [current.Component, retry];
};
