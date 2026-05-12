import React, { useRef } from 'react';
import { Decal, Float, useTexture } from '@react-three/drei';

import { useCleanup } from '../../hooks/useCleanup';

const Ball = (props) => {
  const decal = useTexture(props.imgUrl);
  const meshRef = useRef();
  
  // Cleanup texture on unmount
  useCleanup(meshRef, [decal]);

  return (
    <Float speed={1.75} rotationIntensity={1} floatIntensity={2}>
      <ambientLight intensity={0.25} />
      <directionalLight position={[0, 0, 0.05]} />
      <mesh ref={meshRef} castShadow receiveShadow scale={2.75}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color='#fff8eb'
          polygonOffset
          polygonOffsetFactor={-5}
          flatShading
        />
        <Decal
          position={[0, 0, 1]}
          rotation={[2 * Math.PI, 0, 6.25]}
          scale={1}
          map={decal}
          flatShading
        />
      </mesh>
    </Float>
  );
};

// Canvas wrapper for backward compatibility with Tech section
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Preload } from '@react-three/drei';
import CanvasLoader from '../Loader';

const BallCanvas = ({ icon, label }) => {
  return (
    <Canvas
      frameloop='demand'
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      aria-label={label ?? '3D technology icon'}
      role="img"
    >
      <Suspense fallback={<CanvasLoader />}>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} />
        <Ball imgUrl={icon} />
      </Suspense>
      <Preload all />
    </Canvas>
  );
};

export default BallCanvas;
export { Ball };
