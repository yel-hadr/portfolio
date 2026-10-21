import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MathUtils } from "three";

import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { AutoRotate, ViewCamera } from "./helpers";

const MODEL = "./desktop_pc/scene.gltf";

const Computers = () => {
  const { scene } = useGLTF(MODEL);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const reduced = usePrefersReducedMotion();
  const parallaxRef = useRef();
  const pointerX = useRef(0);

  // Subtle mouse parallax on desktop. The Canvas ignores pointer events, so read them from window.
  useEffect(() => {
    const onMove = (e) => {
      pointerX.current = (e.clientX / window.innerWidth) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(() => {
    if (!parallaxRef.current) return;
    const target = isMobile || reduced ? 0 : pointerX.current * 0.05;
    parallaxRef.current.rotation.y = MathUtils.lerp(parallaxRef.current.rotation.y, target, 0.05);
  });

  return (
    <>
      <ViewCamera position={[20, 0, 5]} fov={25} />
      <AutoRotate speed={0.05}>
        <group ref={parallaxRef}>
          <hemisphereLight intensity={0.8} groundColor="black" />
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
