import Earth from "./Earth";
import BallCanvas from "./Ball";
import Computers from "./Computers";
import Stars from "./Stars";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload } from "@react-three/drei";
import CanvasLoader from "../Loader";

// Export model components (for use in View pattern)
export { Earth, Computers, Stars };

// Keep legacy Canvas wrapper exports for backward compatibility
export { BallCanvas };

// Re-export Earth as EarthCanvas for Contact section compatibility
const EarthCanvas = () => {
  return (
    <Canvas
      shadows
      frameloop='demand'
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{
        fov: 45,
        near: 0.1,
        far: 200,
        position: [-4, 3, 6],
      }}
      aria-label="Interactive 3D Earth model"
      role="img"
    >
      <Suspense fallback={<CanvasLoader />}>
        <OrbitControls
          autoRotate
          enableZoom={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
          enablePan={false}
          autoRotateSpeed={1}
        />
        <Earth />
        <Preload all />
      </Suspense>
    </Canvas>
  );
};

export { EarthCanvas };

// Default export for stars as canvas component
export default Stars;
