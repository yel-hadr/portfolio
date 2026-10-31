import { Suspense, lazy, useContext, useEffect, useRef, useState } from 'react';

import CanvasErrorBoundary from '../CanvasErrorBoundary';
import { Near3DContext } from './Near3DContext';
import { WebGLContext } from './WebGLContext';
import { changeViewsOnScreen } from './viewPresence';

// The drei View lives in a lazy chunk with three/R3F, so first paint needs no 3D code.
const SceneViewImpl = lazy(() => import('./SceneViewImpl'));

// A scene mounts (and fetches its model or textures) once its box is within a viewport of the
// screen: the Contact globe's 480 KB model waits until Contact is close, not until the 3D layer
// mounts at the Tech section. Once mounted it stays
const MOUNT_MARGIN = '100% 0px';
// On the screen for the frame loop: the viewport and the 3D layer's 25vh overscan below it
// (Scene3D), where a view scrolling up is already drawn
const DRAW_MARGIN = '0px 0px 25% 0px';
// The box the scene fills: the slot's size comes from `className` on the outer box
const INNER = 'flex h-full w-full items-center justify-center';

/**
 * SceneView - a DOM slot that renders a 3D scene through the single shared Canvas (Scene3D).
 *
 * Without WebGL2, after a scene error, or if the 3D chunk fails to load, the slot renders a
 * static box with `fallback` instead, so the layout and the rest of the page are unaffected.
 *
 * @param {string} sectionType - name used in error logs ('hero', 'earth', 'ball', ...)
 * @param {string} [label] - accessible name; omit for purely decorative scenes
 * @param {number} [index] - draw order; lower renders first (stars use 1)
 * @param {number} [frames] - how many frames drei measures the box; 1 for fixed boxes
 * @param {React.ReactNode} [fallback] - static DOM shown instead of the scene
 */
const SceneView = ({
  sectionType,
  label,
  className = '',
  index = 2,
  frames = Infinity,
  fallback = null,
  children,
}) => {
  const webgl = useContext(WebGLContext);
  // The 3D half (and three.js with it) loads once the page's 3D layer mounts
  const near = useContext(Near3DContext);
  const [failed, setFailed] = useState(false);
  const box = useRef(null);
  const [close, setClose] = useState(false);
  const live = webgl && !failed && near;

  // Mounts the scene once the box is close; while the scene is live, counts the box as on screen
  // for the frame loop
  useEffect(() => {
    const el = box.current;
    if (!live || !el || typeof IntersectionObserver === 'undefined') {
      if (live) setClose(true);
      return undefined;
    }
    const mount = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setClose(true);
        mount.disconnect();
      },
      { rootMargin: MOUNT_MARGIN }
    );
    let shown = false;
    const draw = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting === shown) return;
        shown = entry.isIntersecting;
        changeViewsOnScreen(shown ? 1 : -1);
      },
      { rootMargin: DRAW_MARGIN }
    );
    mount.observe(el);
    draw.observe(el);
    return () => {
      mount.disconnect();
      draw.disconnect();
      if (shown) changeViewsOnScreen(-1);
    };
  }, [live]);

  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  // The static box shows no model, so it must not announce one
  const staticSlot = (
    <div className={INNER} aria-hidden='true'>
      {fallback}
    </div>
  );
  const empty = <div className={INNER} aria-hidden='true' />;

  let content;
  if (!webgl || failed) content = staticSlot;
  // Until the 3D layer is up and the box is close, the same empty box the loading state shows
  else if (!near || !close) content = empty;
  else {
    content = (
      // Outer boundary catches a failed chunk load; the inner one (in SceneViewImpl) scene errors
      <CanvasErrorBoundary sectionType={sectionType} fallback={staticSlot}>
        <Suspense fallback={empty}>
          <SceneViewImpl
            sectionType={sectionType}
            className={INNER}
            index={index}
            frames={frames}
            a11y={a11y}
            onError={() => setFailed(true)}
          >
            {children}
          </SceneViewImpl>
        </Suspense>
      </CanvasErrorBoundary>
    );
  }

  // The outer box keeps one element through every state, for the observers above
  return (
    <div ref={box} className={className}>
      {content}
    </div>
  );
};

export default SceneView;
