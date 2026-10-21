import { Suspense, lazy, useContext, useState } from 'react';

import CanvasErrorBoundary from '../CanvasErrorBoundary';
import { WebGLContext } from './WebGLContext';

// The drei View lives in a lazy chunk with three/R3F, so first paint needs no 3D code.
const SceneViewImpl = lazy(() => import('./SceneViewImpl'));

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
const SceneView = ({ sectionType, label, className = '', index = 2, frames = Infinity, fallback = null, children }) => {
  const webgl = useContext(WebGLContext);
  const [failed, setFailed] = useState(false);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  // The static box shows no model, so it must not announce one
  const staticSlot = (
    <div className={className} aria-hidden="true">
      {fallback}
    </div>
  );

  if (!webgl || failed) return staticSlot;

  return (
    // Outer boundary catches a failed chunk load; the inner one (in SceneViewImpl) scene errors
    <CanvasErrorBoundary sectionType={sectionType} fallback={staticSlot}>
      <Suspense fallback={<div className={className} aria-hidden="true" />}>
        <SceneViewImpl
          sectionType={sectionType}
          className={className}
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
};

export default SceneView;
