import { Decal, Float, Preload, useTexture } from '@react-three/drei';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

// Rendered through a SceneView, so it shares the root camera (fov 75 at z=5), like the old per-icon Canvas.
// No continuous spin: the logo decal is only on the front face, so the ball floats in place.
const Ball = ({ imgUrl }) => {
  const decal = useTexture(imgUrl);
  const reduced = usePrefersReducedMotion();

  return (
    <>
      {/* Compile shaders and upload the decal while loading, not on the first scroll into view */}
      <Preload all />
      <Float
        speed={reduced ? 0 : 1.75}
        rotationIntensity={reduced ? 0 : 1}
        floatIntensity={reduced ? 0 : 2}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[0, 0, 0.05]} />
        <mesh scale={2.75}>
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
    </>
  );
};

export default Ball;
