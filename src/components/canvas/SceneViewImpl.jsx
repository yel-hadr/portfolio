import { Suspense } from 'react';
import { View } from '@react-three/drei';

import CanvasErrorBoundary from '../CanvasErrorBoundary';

/**
 * The 3D half of SceneView, loaded lazily with the rest of the 3D stack. drei's inline <View>
 * renders the box into the page and tunnels `children` into <View.Port /> (Scene3D), which
 * draws them inside the box's rectangle. Each scene is wrapped in CanvasErrorBoundary.
 */
const SceneViewImpl = ({ sectionType, className, index, frames, a11y, onError, children }) => (
  <View className={className} index={index} frames={frames} {...a11y}>
    <CanvasErrorBoundary sectionType={sectionType} onError={onError}>
      <Suspense fallback={null}>{children}</Suspense>
    </CanvasErrorBoundary>
  </View>
);

export default SceneViewImpl;
