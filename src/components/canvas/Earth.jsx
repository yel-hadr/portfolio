import { useRef } from "react";
import { useGLTF } from "@react-three/drei";

import { useCleanup } from "../../hooks/useCleanup";

const Earth = () => {
  const ref = useRef();
  const { scene } = useGLTF("./planet/scene.gltf");
  
  // Use cleanup hook for proper disposal on unmount
  useCleanup(ref, [scene]);

  return (
    <primitive 
      ref={ref} 
      object={scene} 
      scale={2.5} 
      position-y={0} 
      rotation-y={0} 
    />
  );
};

// Preload the model for faster initial load
useGLTF.preload("./planet/scene.gltf");

export default Earth;
