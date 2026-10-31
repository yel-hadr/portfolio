import { Decal, Float, Preload, useTexture } from '@react-three/drei';
import { useStillMotion } from '../../hooks/useMotionPaused';

// Rendered through a SceneView, so it shares the root camera (fov 75 at z=5), like the old per-icon Canvas.
// No continuous spin: the logo decal is only on the front face, so the ball floats in place.
// `warmUp`: compile the shared ball shaders while loading; one instance is enough.
// Each ball floats at its own pace (0.8x to 1.2x, from its icon's URL), so the twelve never bob in
// step; drei's Float also gives each its own random phase
const paceOf = (key) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return 0.8 + (h % 1000) / 2500;
};

const Ball = ({ imgUrl, warmUp = false }) => {
  const decal = useTexture(imgUrl);
  const reduced = useStillMotion();

  return (
    <>
      {warmUp && <Preload all />}
      <Float
        speed={reduced ? 0 : 1.75 * paceOf(imgUrl)}
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
          <Decal position={[0, 0, 1]} rotation={[2 * Math.PI, 0, 6.25]} scale={1} map={decal} />
        </mesh>
      </Float>
    </>
  );
};

export default Ball;
