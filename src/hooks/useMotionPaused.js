import { useSyncExternalStore } from 'react';

import { usePrefersReducedMotion } from './usePrefersReducedMotion';

// The page's own "Pause animations" switch (WCAG 2.2.2): the waves, the floating balls, the
// globe and the CSS sheens run on their own for longer than 5 seconds, so the page needs a way to
// stop them besides the OS reduced-motion setting. Remembered in localStorage, and mirrored on
// <html data-motion="paused"> for the CSS animations (index.css)
const KEY = 'motion';

const read = () => {
  try {
    return localStorage.getItem(KEY) === 'paused';
  } catch {
    return false;
  }
};

let paused = typeof window !== 'undefined' && read();
const listeners = new Set();

const mirror = () => {
  if (paused) document.documentElement.dataset.motion = 'paused';
  else delete document.documentElement.dataset.motion;
};
if (typeof document !== 'undefined') mirror();

export const setMotionPaused = (value) => {
  paused = value;
  try {
    if (value) localStorage.setItem(KEY, 'paused');
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: the choice lasts for this page only
  }
  mirror();
  for (const listener of listeners) listener();
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether the visitor paused the page's animations with the navbar's switch */
export const useMotionPaused = () =>
  useSyncExternalStore(
    subscribe,
    () => paused,
    () => false
  );

/**
 * For ambient motion that runs on its own (the waves, the balls' float, the globe's spin): still
 * under the OS reduced-motion setting or the page's pause switch. Game Mode and the demos keep
 * usePrefersReducedMotion, since their motion answers the player's input.
 */
export const useStillMotion = () => {
  const reduced = usePrefersReducedMotion();
  const pausedNow = useMotionPaused();
  return reduced || pausedNow;
};
