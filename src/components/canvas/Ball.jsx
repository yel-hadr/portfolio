import { useContext } from 'react';
import { Decal, Float, useTexture } from '@react-three/drei';
import { useStillMotion } from '../../hooks/useMotionPaused';
import { ThemeContext } from '../../theme/context';
import { WarmUp } from './helpers';

// The ball stays light in both themes, so every logo (dark ones too: AWS's lettering, the Ansible
// mark, the Linux penguin) keeps its contrast. What made it read grey was the Canvas's tone
// mapping (off for this material) and the light: a weak ambient and one light from the front
// left the faces turned away mid-grey. Now each theme lights
// it fully: on dark a brighter fill, the front key light and a warm rim in the brand orange from
// behind; on light a white sky over the warm ground (a hemisphere light) and a soft glow of its
// own, so on the cream page it reads white, not dirty. The glow is the ball's alone: the logo
// decal keeps its colors. Hexes: the material and lights are the one place outside the tokens
const BASE = { dark: '#fff8eb', light: '#ffffff' };
const GLOW = { dark: 0.2, light: 0.3 };
const RIM = '#fb923c';
const SKY = '#ffffff';
const GROUND = '#f3eee7';
// One rig in both themes, only its intensities differ: three keys a shader on the number of
// lights of each kind, so a theme switch recompiles nothing and mounts no light. Outside the
// Float, so the key light no longer swings as the ball bobs
const RIG = {
  dark: { ambient: 0.8, sky: 0, key: 1.1, rim: 1.6 },
  light: { ambient: 0.9, sky: 1.2, key: 0.6, rim: 0 },
};
const KEY_AT = [0, 0, 5];
const RIM_AT = [-3, 2, -2];

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
  // The theme through the context the Canvas bridges (null-safe here, inside the 3D tree)
  const theme = useContext(ThemeContext)?.theme === 'light' ? 'light' : 'dark';
  const rig = RIG[theme];

  return (
    <>
      {warmUp && <WarmUp />}
      <ambientLight intensity={rig.ambient} />
      <hemisphereLight args={[SKY, GROUND]} intensity={rig.sky} />
      <directionalLight position={KEY_AT} intensity={rig.key} />
      <directionalLight position={RIM_AT} color={RIM} intensity={rig.rim} />
      <Float
        speed={reduced ? 0 : 1.75 * paceOf(imgUrl)}
        rotationIntensity={reduced ? 0 : 1}
        floatIntensity={reduced ? 0 : 2}
      >
        {/* Detail 2: rounder than the old 20-face chip, still faceted (flat shading) */}
        <mesh scale={2.75}>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial
            color={BASE[theme]}
            emissive={BASE[theme]}
            emissiveIntensity={GLOW[theme]}
            polygonOffset
            polygonOffsetFactor={-5}
            flatShading
            // The Canvas's ACES tone mapping pulled the lit cream and white down to a mid-grey:
            // without it the ball keeps the color its light gives it
            toneMapped={false}
          />
          <Decal position={[0, 0, 1]} rotation={[2 * Math.PI, 0, 6.25]} scale={1} map={decal} />
        </mesh>
      </Float>
    </>
  );
};

export default Ball;
