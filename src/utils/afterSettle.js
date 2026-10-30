// Runs a background prefetch once the page has loaded and the hero's entrance has played, then
// waits for idle time: an early prefetch (three.js alone is ~180 KB) would compete with what the
// first screen needs on a slow connection. Returns a cancel function, for an effect's cleanup
export const afterSettle = (task, delay = 3000) => {
  const idle = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 1));
  const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
  let timer = null;
  let handle = null;
  const start = () => {
    timer = window.setTimeout(() => {
      handle = idle(task, { timeout: 5000 });
    }, delay);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
  return () => {
    window.removeEventListener('load', start);
    window.clearTimeout(timer);
    if (handle !== null) cancelIdle(handle);
  };
};
