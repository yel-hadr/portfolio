import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { View } from '@react-three/drei';

import LoadingProgress from '../LoadingProgress';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const AMBIENT_FPS = 30;

/**
 * Drives the demand frameloop. Scroll and resize redraw at full rate so every View keeps up
 * with its DOM box (2 frames: drei draws a view one frame after it reports entering the
 * screen). Ambient motion (rotation, Float, stars) ticks at ~30 fps, and pointer moves redraw
 * at full rate for the hero parallax. With reduced motion only scroll and resize redraw.
 * Hidden tabs cost nothing: requestAnimationFrame pauses.
 */
const FrameDriver = ({ reduced }) => {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const redraw = () => invalidate(2);
    window.addEventListener('scroll', redraw, { passive: true });
    window.addEventListener('resize', redraw);
    if (!reduced) window.addEventListener('pointermove', redraw, { passive: true });

    let raf = 0;
    let last = 0;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last >= 1000 / AMBIENT_FPS - 1) {
        last = t;
        invalidate();
      }
    };
    if (!reduced) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', redraw);
      window.removeEventListener('resize', redraw);
      window.removeEventListener('pointermove', redraw);
    };
  }, [invalidate, reduced]);

  return null;
};

/**
 * The 3D layer, loaded lazily: one fixed Canvas behind the page renders every SceneView
 * through <View.Port />. Inline style because R3F's own `position: relative` beats classes.
 */
const Scene3D = () => {
  const reduced = usePrefersReducedMotion();

  return (
    <>
      <LoadingProgress />
      <Canvas
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        frameloop='demand'
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        aria-hidden='true'
        onCreated={({ gl, invalidate }) => {
          // Redraw once the GPU hands the context back after a loss
          gl.domElement.addEventListener('webglcontextrestored', () => invalidate());
        }}
      >
        <View.Port />
        <FrameDriver reduced={reduced} />
      </Canvas>
    </>
  );
};

export default Scene3D;
