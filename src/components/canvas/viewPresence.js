import { useSyncExternalStore } from 'react';

// How many SceneView boxes are on the screen, or in the 3D layer's overscan just below it.
// FrameDriver (Scene3D) ticks the ambient motion only while one is: with none in sight (the
// About, Works or Blog sections) the 3D layer draws nothing at all. Plain module state, read by
// the DOM half (SceneView) and the lazy Canvas alike, so it adds no three.js to the page chunks
let onScreen = 0;
const listeners = new Set();

export const changeViewsOnScreen = (delta) => {
  onScreen += delta;
  for (const listener of listeners) listener();
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether any 3D view is on the screen (or about to scroll onto it) */
export const useViewsOnScreen = () =>
  useSyncExternalStore(
    subscribe,
    () => onScreen > 0,
    () => false
  );

// Frames on request: something in the DOM that moves a 3D view's box (a bento card's spring
// reveal) asks the frame loop to keep drawing for a while, so the scene follows its box even with
// the ambient ticks off (the pause switch). FrameDriver (Scene3D) listens
const frameListeners = new Set();

/** Ask the 3D layer to redraw every frame for `ms` milliseconds */
export const requestFrames = (ms) => {
  for (const listener of frameListeners) listener(ms);
};

export const onFrameRequest = (listener) => {
  frameListeners.add(listener);
  return () => frameListeners.delete(listener);
};
