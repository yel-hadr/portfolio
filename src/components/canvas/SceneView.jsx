import { Suspense, useState } from 'react';
import { View } from '@react-three/drei';

import CanvasErrorBoundary from '../CanvasErrorBoundary';

/**
 * SceneView - a DOM slot that renders a 3D scene through the single shared Canvas.
 *
 * drei's inline <View> renders this box into the page and tunnels `children` into the
 * <View.Port /> of the Canvas in App.jsx, which draws them inside this box's rectangle.
 * Every scene is wrapped in CanvasErrorBoundary; if it fails, the slot swaps to a static
 * DOM fallback and the rest of the page keeps rendering.
 *
 * @param {string} sectionType - name used in error logs ('hero', 'earth', 'ball', ...)
 * @param {string} [label] - accessible name; omit for purely decorative scenes
 * @param {number} [index] - draw order; lower renders first (stars use 1)
 * @param {React.ReactNode} [fallback] - DOM shown if the scene throws
 */
const SceneView = ({ sectionType, label, className = '', index = 2, fallback = null, children }) => {
  const [failed, setFailed] = useState(false);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };

  if (failed) {
    return (
      <div className={className} {...a11y}>
        {fallback}
      </div>
    );
  }

  return (
    <View className={className} index={index} {...a11y}>
      <CanvasErrorBoundary sectionType={sectionType} onError={() => setFailed(true)}>
        <Suspense fallback={null}>{children}</Suspense>
      </CanvasErrorBoundary>
    </View>
  );
};

export default SceneView;
