import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';

import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const ORIGIN = [0, 0, 0];

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
 * which also captured pointer/touch input). Stops when the user prefers reduced motion.
 * Keep useFrame callbacks null-safe: R3F does not wrap them, so a throw here escapes
 * every error boundary and blanks all views.
 * @param {number} speed - radians per second
 */
export const AutoRotate = ({ speed = 0.1, children, ...props }) => {
  const ref = useRef();
  const reduced = usePrefersReducedMotion();
  useFrame((_, delta) => {
    if (!reduced && ref.current) ref.current.rotation.y += Math.min(delta, 0.1) * speed;
  });
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
};
