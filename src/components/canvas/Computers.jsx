import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { useCleanup } from "../../hooks/useCleanup";

const Computers = ({ isMobile }) => {
  const ref = useRef();
  const { scene } = useGLTF("./desktop_pc/scene.gltf");
  
  // Use cleanup hook for proper disposal on unmount
  useCleanup(ref, [scene]);

  // Mouse parallax effect for desktop
  useFrame(({ mouse }) => {
    if (ref.current && !isMobile) {
      ref.current.rotation.y = THREE.MathUtils.lerp(
        ref.current.rotation.y,
        mouse.x * 0.05,
        0.05
      );
    }
  });

  return (
    <mesh ref={ref}>
      <hemisphereLight intensity={0.8} groundColor="black" />
      <pointLight intensity={1} />
      <spotLight
        position={[-20, 50, 10]}
        angle={0.12}
        penumbra={1}
        intensity={1}
        castShadow
        shadow-mapSize={1024}
      />
      <primitive
        object={scene}
        scale={isMobile ? 0.5 : 0.75}
        position={isMobile ? [0, -3, -1.5] : [0, -2.9, -1.5]}
        rotation={[0, -0.1, -0.1]}
      />
    </mesh>
  );
};

// Preload the model for faster initial load
useGLTF.preload("./desktop_pc/scene.gltf");

export default Computers;
