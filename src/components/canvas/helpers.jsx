import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';

import { useStillMotion } from '../../hooks/useMotionPaused';

const ORIGIN = [0, 0, 0];

/**
 * Compiles the shaders of the view it is in (inside a drei View, `scene` is the view's own) as
 * soon as it mounts, off the frame that first draws it. Scenes mount a viewport ahead of their
 * box, so the GPU driver has time to compile in parallel. Unlike drei's Preload, it renders
 * nothing into a cube target (whose linear output compiled extra programs the screen never used)
 */
export const WarmUp = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    gl.compileAsync(scene, camera).catch(() => {});
  }, [gl, scene, camera]);
  return null;
};

/**
 * Per-view camera that looks at `target`. Each <View> needs its own default camera,
 * otherwise all views share (and fight over) the root camera.
 */
export const ViewCamera = ({ target = ORIGIN, ...props }) => {
  const ref = useRef();
  const [x, y, z] = target;
  useLayoutEffect(() => {
    ref.current?.lookAt(x, y, z);
  }, [x, y, z]);
  return <PerspectiveCamera ref={ref} makeDefault {...props} />;
};

/**
 * Slowly spins its children around the Y axis (replaces OrbitControls autoRotate,
 * which also captured pointer/touch input). Stops under reduced motion or the navbar's pause switch.
 * Keep useFrame callbacks null-safe: R3F does not wrap them, so a throw here escapes
 * every error boundary and blanks all views.
 * @param {number} speed - radians per second
 */
export const AutoRotate = ({ speed = 0.1, children, ...props }) => {
  const ref = useRef();
  const reduced = useStillMotion();
  useFrame((_, delta) => {
    if (!reduced && ref.current) ref.current.rotation.y += Math.min(delta, 0.1) * speed;
  });
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
};
