import { useState, useRef, Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Preload } from "@react-three/drei";
import * as random from "maath/random/dist/maath-random.esm";

const STAR_CONFIG = {
  COUNT: 5000,
  SIZE: 0.002,
  RADIUS: 1.2,
  ROTATION_SPEED_X: 0.1,
  ROTATION_SPEED_Y: 0.067,
};

const Stars = (props) => {
  const ref = useRef();
  const [sphere] = useState(() =>
    random.inSphere(new Float32Array(STAR_CONFIG.COUNT), { radius: STAR_CONFIG.RADIUS })
  );

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta * STAR_CONFIG.ROTATION_SPEED_X;
      ref.current.rotation.y -= delta * STAR_CONFIG.ROTATION_SPEED_Y;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points
        ref={ref}
        positions={sphere}
        stride={3}
        frustumCulled
        {...props}
      >
        <PointMaterial
          transparent
          color="#f272c8"
          size={STAR_CONFIG.SIZE}
          sizeAttenuation={true}
          depthWrite={false}
        />
      </Points>
    </group>
  );
};

const StarsCanvas = () => {
  return (
    <div className='w-full h-auto absolute inset-0 z-[-1]'>
      <Canvas
        camera={{ position: [0, 0, 1] }}
        aria-label="Animated starfield background"
        role="img"
      >
        <Suspense fallback={null}>
          <Stars />
        </Suspense>

        <Preload all />
      </Canvas>
    </div>
  );
};

export default StarsCanvas;