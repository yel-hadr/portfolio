import { Suspense, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { View } from '@react-three/drei';

import CanvasErrorBoundary from '../CanvasErrorBoundary';

// Rendered after the scene inside its Suspense: it mounts only once everything the scene suspends
// on (its chunk, its textures) has arrived, then says so after the view has been drawn twice, so
// the placeholder never leaves an empty box for a frame (drei draws a view a frame after it
// measures it). Only where there is a placeholder to take down
const READY_FRAMES = 2;
const Ready = ({ onReady }) => {
  const frames = useRef(0);
  useFrame((state) => {
    if (frames.current >= READY_FRAMES) return;
    frames.current += 1;
    // On demand, with motion stilled, nothing else may ask for the second frame
    if (frames.current < READY_FRAMES) state.invalidate();
    else requestAnimationFrame(() => onReady());
  });
  return null;
};

/**
 * The 3D half of SceneView, loaded lazily with the rest of the 3D stack. drei's inline <View>
 * renders the box into the page and tunnels `children` into <View.Port /> (Scene3D), which
 * draws them inside the box's rectangle. Each scene is wrapped in CanvasErrorBoundary.
 * `placeholder` stays over the box until the scene is ready, so a slow scene chunk or texture is
 * not an empty hole.
 */
const SceneViewImpl = ({
  sectionType,
  className,
  index,
  frames,
  a11y,
  onError,
  placeholder,
  children,
}) => {
  const [ready, setReady] = useState(false);
  return (
    <div className='relative h-full w-full'>
      <View className={className} index={index} frames={frames} {...a11y}>
        <CanvasErrorBoundary sectionType={sectionType} onError={onError}>
          <Suspense fallback={null}>
            {children}
            {placeholder && <Ready onReady={() => setReady(true)} />}
          </Suspense>
        </CanvasErrorBoundary>
      </View>
      {placeholder && !ready && (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 flex items-center justify-center'
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default SceneViewImpl;
