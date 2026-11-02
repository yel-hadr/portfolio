// A dialog whose code failed to load closes itself (its error boundary): this says why, in one
// short notice (LoadNotice, rendered once in App). Any part of the page posts here, so Works
// (inside the lazy sections) and App share it. `key`: errors.loadFailed.<key> in core.json.
// Opening a dialog clears it: the message would no longer be true, and the chip would sit over
// the dialog
const failures = new Set();
const clears = new Set();

export const notifyLoadFailure = (key) => {
  failures.forEach((listener) => listener(key));
};

export const clearLoadNotice = () => {
  clears.forEach((listener) => listener());
};

export const onLoadFailure = (listener) => {
  failures.add(listener);
  return () => failures.delete(listener);
};

export const onLoadNoticeClear = (listener) => {
  clears.add(listener);
  return () => clears.delete(listener);
};
