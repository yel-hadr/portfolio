import { useContext, useEffect, useState } from 'react';

import { PageCanvasContext } from '../components/canvas/PageCanvasContext';
import { WebGLContext } from '../components/canvas/WebGLContext';

// R3F 9 releases an unmounted Canvas's WebGL context (dispose, then forceContextLoss) as soon as the
// unmount commits; this leaves a margin for the commit and the browser
export const CONTEXT_RELEASE_MS = 600;

/**
 * For a view that brings its own Canvas (the live demos, Game Mode): while `active`, the page's
 * shared Canvas is paused (PageCanvasContext), and `ready` turns true once R3F has released the
 * page's WebGL context, so the page never holds two contexts at once.
 */
export const useDemoCanvas = (active = true) => {
  const webgl = useContext(WebGLContext);
  const pausePageCanvas = useContext(PageCanvasContext);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    pausePageCanvas(true);
    const timer = window.setTimeout(() => setReady(true), webgl ? CONTEXT_RELEASE_MS : 0);
    return () => {
      window.clearTimeout(timer);
      setReady(false);
      pausePageCanvas(false);
    };
  }, [active, pausePageCanvas, webgl]);

  return { webgl, ready };
};
