import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MathUtils } from 'three';

import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { AutoRotate, ViewCamera } from './helpers';

// Meshopt + WebP GLBs (gltf-transform optimize, see CLAUDE.md). Phones get the 512px-texture
// variant; decided once at module load so the preload and useGLTF use the same file.
const MODEL = window.matchMedia('(max-width: 768px)').matches
  ? './desktop_pc/scene-512.glb'
  : './desktop_pc/scene.glb';

const Computers = () => {
  const { scene } = useGLTF(MODEL);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const reduced = usePrefersReducedMotion();
  const parallaxRef = useRef();
  const pointerX = useRef(0);

  // Subtle mouse parallax on desktop. The Canvas ignores pointer events, so read them from window.
  useEffect(() => {
    const onMove = (e) => {
      pointerX.current = (e.clientX / window.innerWidth) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // damp() is frame-rate independent, so the easing feels the same under the ~30 fps demand loop
  useFrame((_, delta) => {
    if (!parallaxRef.current) return;
    const target = isMobile || reduced ? 0 : pointerX.current * 0.05;
    parallaxRef.current.rotation.y = MathUtils.damp(
      parallaxRef.current.rotation.y,
      target,
      3,
      Math.min(delta, 0.1)
    );
  });

  return (
    <>
      <ViewCamera position={[20, 0, 5]} fov={25} />
      <AutoRotate speed={0.05}>
        <group ref={parallaxRef}>
          <hemisphereLight intensity={0.8} groundColor='black' />
          <pointLight intensity={1} />
          <spotLight position={[-20, 50, 10]} angle={0.12} penumbra={1} intensity={1} />
          <primitive
            object={scene}
            scale={isMobile ? 0.5 : 0.75}
            position={isMobile ? [0, -3, -1.5] : [0, -2.9, -1.5]}
            rotation={[0, -0.1, -0.1]}
          />
        </group>
      </AutoRotate>
    </>
  );
};

useGLTF.preload(MODEL);

export default Computers;
