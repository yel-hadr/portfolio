import { useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Decal, Float, useTexture } from '@react-three/drei';
import { Color, MathUtils } from 'three';
import { useStillMotion } from '../../hooks/useMotionPaused';
import { ThemeContext } from '../../theme/context';
import { pointerCard } from '../../utils/pointerCard';
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

// While its card is lit under the pointer (useSpotlight) a ball leans toward it, up to TILT radians
// once the pointer is REACH px away, and answers the card's light. On the ambient ticks
// (FrameDriver): a pointer move asks for no frame of its own. On dark it glows a little more; on
// light it is already full white, which cannot get brighter, so it warms instead, as that theme's
// spotlight rim does
const TILT = 0.18;
const REACH = 200;
const LEAN_RATE = 8;
const LIT = {
  dark: { rest: new Color(BASE.dark), lit: new Color(BASE.dark), glow: 0.14 },
  light: { rest: new Color(BASE.light), lit: new Color('#ffeedd'), glow: 0 },
};

// How lit a ball is, 0 to 1, on the material
const light = (material, tint, rest, amount) => {
  material.userData.lit = amount;
  material.emissiveIntensity = rest + tint.glow * amount;
  material.color.lerpColors(tint.rest, tint.lit, amount);
  material.emissive.copy(material.color);
};

// Outside the component: the React Compiler rejects property writes on what it holds
const follow = (group, material, box, tint, rest, delta) => {
  if (!group || !material) return;
  const { card, x, y } = pointerCard;
  let turnX = 0;
  let turnY = 0;
  let lit = 0;
  if (card && box && card.contains(box)) {
    const { left, top, width, height } = box.getBoundingClientRect();
    turnY = MathUtils.clamp((x - left - width / 2) / REACH, -1, 1) * TILT;
    turnX = MathUtils.clamp((y - top - height / 2) / REACH, -1, 1) * TILT;
    lit = 1;
  }
  const dt = Math.min(delta, 0.1);
  group.rotation.x = MathUtils.damp(group.rotation.x, turnX, LEAN_RATE, dt);
  group.rotation.y = MathUtils.damp(group.rotation.y, turnY, LEAN_RATE, dt);
  light(material, tint, rest, MathUtils.damp(material.userData.lit ?? 0, lit, LEAN_RATE, dt));
};

// Back to rest at once (the pause switch, reduced motion)
const settle = (group, material, tint, rest) => {
  group?.rotation.set(0, 0, 0);
  if (material) light(material, tint, rest, 0);
};

const Ball = ({ imgUrl, warmUp = false, boxRef }) => {
  const decal = useTexture(imgUrl);
  const reduced = useStillMotion();
  // The theme through the context the Canvas bridges (null-safe here, inside the 3D tree)
  const theme = useContext(ThemeContext)?.theme === 'light' ? 'light' : 'dark';
  const rig = RIG[theme];
  const lean = useRef(null);
  const surface = useRef(null);

  useFrame((_, delta) => {
    if (reduced) settle(lean.current, surface.current, LIT[theme], GLOW[theme]);
    else follow(lean.current, surface.current, boxRef?.current, LIT[theme], GLOW[theme], delta);
  });

  return (
    <>
      {warmUp && <WarmUp />}
      <ambientLight intensity={rig.ambient} />
      <hemisphereLight args={[SKY, GROUND]} intensity={rig.sky} />
      <directionalLight position={KEY_AT} intensity={rig.key} />
      <directionalLight position={RIM_AT} color={RIM} intensity={rig.rim} />
      {/* The lean, outside the Float, so the two motions add up */}
      <group ref={lean}>
        <Float
          speed={reduced ? 0 : 1.75 * paceOf(imgUrl)}
          rotationIntensity={reduced ? 0 : 1}
          floatIntensity={reduced ? 0 : 2}
        >
          {/* Detail 2: rounder than the old 20-face chip, still faceted (flat shading) */}
          <mesh scale={2.75}>
            <icosahedronGeometry args={[1, 2]} />
            <meshStandardMaterial
              ref={surface}
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
      </group>
    </>
  );
};

export default Ball;
