import { Suspense, useEffect, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Preload, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import CanvasLoader from "../Loader";

const Computers = ({ isMobile }) => {
  const computer = useGLTF("./desktop_pc/scene.gltf");
  const ref = useRef();

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

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      computer.scene.traverse((child) => {
        if (!child.isMesh) return;

        child.geometry?.dispose?.();

        const materials = Array.isArray(child.material)
          ? child.material
          : child.material
            ? [child.material]
            : [];

        materials.forEach((material) => {
          material?.dispose?.();
        });
      });
    };
  }, [computer]);

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
        object={computer.scene}
        scale={isMobile ? 0.5 : 0.75}
        position={isMobile ? [0, -3, -1.5] : [0, -2.9, -1.5]}
        rotation={[0, -0.1, -0.1]}
        dispose={null}
      />
    </mesh>
  );
};

const ComputersCanvas = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobile(mediaQuery.matches);
    const handler = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []); // FIXED: Added dependency array to prevent infinite re-renders

  return (
    <Canvas
      frameloop="demand"
      shadows
      camera={{ position: [20, 3, 5], fov: 25 }}
      gl={{ preserveDrawingBuffer: true }}
      dpr={[1, 2]}
      aria-label="Interactive 3D computer model"
      role="img"
    >
      <Suspense fallback={<CanvasLoader />}>
        <OrbitControls
          enableZoom={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
        <Computers isMobile={isMobile} />
      </Suspense>
      <Preload all />
    </Canvas>
  );
};
export default ComputersCanvas