import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DoubleSide,
  FogExp2,
  MathUtils,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  SpriteMaterial,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';

import { readTheme, rgb } from '../../utils/themeColors';
import Gauntlet from './Gauntlet';
import {
  CABLES,
  CRATES,
  HOLOGRAM,
  LAMPS,
  LASER_GRID,
  RACKS,
  RACK_SIZE,
  ROOM_ACCENT,
  ROOM_LIGHTS,
  roomAt,
} from './rooms';

// Game Mode's look: map.cub's grid as a dark "DevOps facility" in lockdown. Lit PBR materials
// (paneled walls with orange and blue accent lines, metal grating, ceiling plates), neon strips
// along every baseboard in the room's color, blast doors that slide apart with a puff of dust,
// server racks, crates, cables, flickering lamps, the command hub's hologram and the vault's
// laser grid; a flashlight on the gauntlet (the only shadow caster) with a beam through the fog,
// and bloom, vignette, chromatic aberration, grain and tone mapping on top. Loaded only by Game
// Mode (the cub3D demo keeps its own textures), so the post-processing code is its chunk.
//
// `flat` is the high contrast mode: bright flat colors, no fog, lights or post-processing.

const DOOR_DEPTH = 0.16;
const DUST_LIFE = 1.1;
const FOG_DENSITY = 0.14;
const BEAM_LENGTH = 6;

const TOKENS = [
  'background',
  'foreground',
  'foreground-muted',
  'surface-raised',
  'primary',
  'primary-400',
  'info',
  'success',
  'danger',
  'secondary',
];

// three's Color parses 'rgb(r,g,b)', not the 'R G B' channels the tokens hold
const toColor = (channels, k = 1) =>
  new Color(`rgb(${channels.split(' ').join(',')})`).multiplyScalar(k);
const luminance = (channels) => channels.split(' ').reduce((a, v) => a + Number(v), 0);

const canvasTexture = (size, paint, repeat) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(...repeat);
  }
  return texture;
};

// The textures, painted from the theme's colors (`c.dark` and `c.light` are the darker and the
// lighter of the background and foreground, so the facility is dark in either theme)
const paintWall = (c) => (ctx, s) => {
  ctx.fillStyle = rgb(c.dark);
  ctx.fillRect(0, 0, s, s);
  // Two columns of three panels, with darker seams and rivets
  const pw = s / 2;
  const ph = s / 3;
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      ctx.fillStyle = rgb(c.muted, 0.1 + ((i + j) % 2) * 0.04);
      ctx.fillRect(i * pw + 3, j * ph + 3, pw - 6, ph - 6);
      ctx.fillStyle = rgb(c.light, 0.18);
      [
        [6, 6],
        [pw - 8, 6],
        [6, ph - 8],
        [pw - 8, ph - 8],
      ].forEach(([x, y]) => ctx.fillRect(i * pw + x, j * ph + y, 2, 2));
    }
  }
  // Vent slits in the top panels
  ctx.fillStyle = rgb(c.dark, 0.9);
  for (let y = 12; y < ph - 8; y += 5) ctx.fillRect(14, y, pw - 28, 2);
};
// The emissive layer: one accent line around two thirds down, and a status LED
const paintWallGlow = (ctx, s) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, Math.round(s * 0.7), s, 3);
  ctx.fillRect(s - 14, 10, 4, 4);
};
const paintFloor = (c) => (ctx, s) => {
  ctx.fillStyle = rgb(c.dark);
  ctx.fillRect(0, 0, s, s);
  // Grating: bars with holes between them
  ctx.fillStyle = rgb(c.muted, 0.32);
  for (let i = 0; i < s; i += 16) {
    ctx.fillRect(i, 0, 3, s);
    ctx.fillRect(0, i, s, 3);
  }
  ctx.fillStyle = rgb(c.light, 0.1);
  for (let i = 0; i < s; i += 16) ctx.fillRect(i, 0, 1, s);
};
const paintCeiling = (c) => (ctx, s) => {
  ctx.fillStyle = rgb(c.dark);
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = rgb(c.muted, 0.12);
  ctx.fillRect(4, 4, s - 8, s - 8);
  ctx.fillStyle = rgb(c.dark, 0.8);
  ctx.fillRect(s / 2 - 1, 0, 2, s);
};
const paintDoor = (c) => (ctx, s) => {
  ctx.fillStyle = rgb(c.muted, 0.35);
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = rgb(c.dark, 0.6);
  for (let y = 8; y < s * 0.75; y += 20) ctx.fillRect(6, y, s - 12, 3);
  // Hazard stripes along the bottom
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, s * 0.8, s, s * 0.2);
  ctx.clip();
  ctx.fillStyle = rgb(c.primary);
  ctx.fillRect(0, s * 0.8, s, s * 0.2);
  ctx.fillStyle = rgb(c.dark);
  for (let x = -s; x < s * 2; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, s);
    ctx.lineTo(x + 10, s);
    ctx.lineTo(x + 10 + s * 0.2, s * 0.8);
    ctx.lineTo(x + s * 0.2, s * 0.8);
    ctx.fill();
  }
  ctx.restore();
};
const paintDoorGlow = (ctx, s) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#fff';
  ctx.fillRect(s / 2 - 10, s * 0.4, 20, 6);
};
const paintRack = (c) => (ctx, s) => {
  ctx.fillStyle = rgb(c.dark);
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = rgb(c.muted, 0.2);
  for (let y = 4; y < s - 4; y += 10) ctx.fillRect(4, y, s - 8, 7);
};
// Rows of LEDs; scrolling this texture makes them blink
const paintRackGlow = (ctx, s) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, s, s);
  for (let y = 6; y < s - 4; y += 10) {
    for (let x = 8; x < s - 6; x += 6) {
      if ((x * 7 + y * 13) % 5 < 2) continue;
      ctx.fillStyle = (x + y) % 3 ? '#fff' : '#888';
      ctx.fillRect(x, y, 2, 2);
    }
  }
};
const paintCrate = (c) => (ctx, s) => {
  ctx.fillStyle = rgb(c.muted, 0.45);
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = rgb(c.dark, 0.75);
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, s - 8, s - 8);
  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.lineTo(s - 6, s - 6);
  ctx.stroke();
  ctx.fillStyle = rgb(c.primary, 0.85);
  ctx.fillRect(s * 0.6, 8, s * 0.3, 6);
};
const paintLabel = (c, text) => (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = rgb(c.primary400);
  ctx.font = `bold ${Math.round(s / 9)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, s / 2, s / 2, s - 8);
};

// Every floor edge against a wall, for the baseboard strips: [x, z, yaw, room]
const baseboards = (isFloor, W, H) => {
  const out = [];
  for (let z = 0; z < H; z += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!isFloor(x, z)) continue;
      const room = roomAt(x + 0.5, z + 0.5) ?? 'about';
      if (!isFloor(x, z - 1)) out.push([x + 0.5, z + 0.012, 0, room]);
      if (!isFloor(x, z + 1)) out.push([x + 0.5, z + 0.988, 0, room]);
      if (!isFloor(x - 1, z)) out.push([x + 0.012, z + 0.5, Math.PI / 2, room]);
      if (!isFloor(x + 1, z)) out.push([x + 0.988, z + 0.5, Math.PI / 2, room]);
    }
  }
  return out;
};

// A blast door's halves slide apart along the corridor's width: across x when the walls are at
// x - 1 and x + 1, else across z
const doorAxis = (cell, isFloor, W) => {
  const x = cell % W;
  const z = Math.floor(cell / W);
  return !isFloor(x - 1, z) && !isFloor(x + 1, z) ? 'x' : 'z';
};

// The flashlight's visible beam: a cone, brightest at the lens, fading with distance and toward
// its rim; drawn additively, so it reads as light scattered in the fog
const BEAM_SHADER = {
  uniforms: { color: { value: new Color(1, 0.95, 0.85) }, strength: { value: 0.07 } },
  vertexShader: `
    varying float vAlong;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vAlong = uv.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 color;
    uniform float strength;
    varying float vAlong;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      // Brightest where the cone faces the eye, nothing at its silhouette: no hard rim
      float facing = abs(dot(vNormal, vView));
      float fade = pow(vAlong, 2.2);
      gl_FragColor = vec4(color * strength * facing * fade, 1.0);
    }`,
};

const dummy = new Object3D();
const NO_OFFSET = new Vector2(0, 0);
const FLASHLIGHT = new Color(1, 0.95, 0.85);
// The flashlight sits just ahead of the eye (the player can stand 0.2 from a wall, so it never
// ends up inside the wall faced)
const LENS = [0.1, -0.07, -0.1];
// Past this the fog has swallowed nearly everything: the light and its shadows stop here
const REACH = 9;

/**
 * The post-processing, on its own so it is built once: Bloom, then the passes that merge into
 * one (grain, vignette, tone mapping), then the chromatic aberration (a convolution: last, so it
 * does not split them). Its buffers follow the pixel ratio, and are freed on unmount
 */
const PostFx = memo(function PostFx({ aberration }) {
  const composer = useRef(null);
  const dpr = useThree((s) => s.viewport.dpr);
  useEffect(() => {
    composer.current?.setSize();
  }, [dpr]);
  useEffect(() => {
    const made = composer.current;
    return () => made?.dispose();
  }, []);
  return (
    <EffectComposer ref={composer} multisampling={0}>
      <Bloom
        mipmapBlur
        levels={6}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.25}
        intensity={0.95}
      />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.18} />
      <Vignette offset={0.32} darkness={0.78} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <ChromaticAberration
        ref={aberration}
        offset={NO_OFFSET}
        radialModulation
        modulationOffset={0.2}
      />
    </EffectComposer>
  );
});

/**
 * @param shell       the wall cells to draw ({ x, z })
 * @param isFloor     (x, z) => whether a cell is floor
 * @param doorCells   the door cells; `closedDoors` their state ({ [cell]: true while closed })
 * @param weapon      the weapon in hand; `motion` the shared recoil, bob and sway
 * @param postFx      a shared ref: { aberration } (0..1), pulsed by a shot or a hit
 */
const Facility = ({
  shell,
  isFloor,
  W,
  H,
  doorCells,
  closedDoors,
  reduced,
  flat,
  weapon,
  motion,
  postFx,
  hologramLabel,
}) => {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  const walls = useRef(null);
  const strips = useRef(null);
  const doorMesh = useRef(null);
  const rackMesh = useRef(null);
  const crateMesh = useRef(null);
  const lampMesh = useRef(null);
  const laserMesh = useRef(null);
  const holo = useRef(null);
  const roomLight = useRef(null);
  const lit = useRef(null);
  const lampsOn = useRef([]);
  const spot = useRef(null);
  const spotTarget = useRef(null);
  const aberration = useRef(null);
  const clock = useRef(0);
  const boards = useMemo(() => baseboards(isFloor, W, H), [isFloor, W, H]);

  // Everything GPU-side made here (not R3F's), so freed on unmount below
  const res = useMemo(() => {
    const t = readTheme(TOKENS);
    const darkFirst = luminance(t.background) < luminance(t.foreground);
    const c = {
      dark: darkFirst ? t.background : t.foreground,
      light: darkFirst ? t.foreground : t.background,
      muted: t['foreground-muted'],
      primary: t.primary,
      primary400: t['primary-400'],
      info: t.info,
      success: t.success,
      danger: t.danger,
      secondary: t.secondary,
    };
    const accent = (room, k) => toColor(t[ROOM_ACCENT[room]], k);
    const textures = [];
    const tex = (size, paint, repeat) => {
      const texture = canvasTexture(size, paint, repeat);
      textures.push(texture);
      return texture;
    };
    const box = new BoxGeometry(1, 1, 1);
    const hidden = new MeshBasicMaterial({ visible: false });
    let wallMaterials;
    let floor;
    let ceiling;
    let door;
    let rack;
    let crate;
    if (flat) {
      // High contrast: each wall side its own flat shade, so corners stay visible without light
      const plain = (channels) => new MeshBasicMaterial({ color: toColor(channels) });
      const side = plain(c.light);
      const end = plain(c.muted);
      wallMaterials = [end, end, hidden, hidden, side, side];
      floor = plain(c.dark);
      ceiling = plain(t['surface-raised']);
      door = plain(t.danger);
      rack = plain(t.info);
      crate = plain(t.primary);
    } else {
      const wallMap = tex(128, paintWall(c));
      const wallGlow = tex(128, paintWallGlow);
      // Orange accent lines on the north and south faces, blue on the east and west: the
      // sides stay told apart, as the original's four textures are
      const wall = (color) =>
        new MeshLambertMaterial({
          map: wallMap,
          emissiveMap: wallGlow,
          emissive: color,
          emissiveIntensity: 2.4,
        });
      const ns = wall(toColor(t.primary));
      const ew = wall(toColor(t.info));
      wallMaterials = [ew, ew, hidden, hidden, ns, ns];
      floor = new MeshStandardMaterial({
        map: tex(64, paintFloor(c), [W + 2, H + 2]),
        metalness: 0.75,
        roughness: 0.4,
      });
      ceiling = new MeshLambertMaterial({
        map: tex(64, paintCeiling(c), [W + 2, H + 2]),
      });
      door = new MeshStandardMaterial({
        map: tex(128, paintDoor(c)),
        emissiveMap: tex(128, paintDoorGlow),
        emissive: toColor(t.danger),
        emissiveIntensity: 3,
        metalness: 0.7,
        roughness: 0.45,
      });
      const rackGlow = tex(64, paintRackGlow);
      rack = new MeshStandardMaterial({
        map: tex(64, paintRack(c)),
        emissiveMap: rackGlow,
        emissive: toColor(t.success),
        emissiveIntensity: 2.6,
        metalness: 0.6,
        roughness: 0.5,
      });
      rack.userData.glow = rackGlow;
      crate = new MeshLambertMaterial({
        map: tex(64, paintCrate(c)),
      });
    }
    const glowMaterial = () => new MeshBasicMaterial({ toneMapped: false });
    const strip = glowMaterial();
    const lamp = glowMaterial();
    const laser = new MeshBasicMaterial({
      color: toColor(t.danger, flat ? 1 : 1.8),
      toneMapped: false,
      transparent: !flat,
      opacity: flat ? 1 : 0.85,
    });
    const cable = flat
      ? new MeshBasicMaterial({ color: toColor(c.muted) })
      : new MeshStandardMaterial({ color: toColor(c.dark), roughness: 0.6, metalness: 0.4 });
    const cables = CABLES.map(([x0, z0, x1, z1, low]) => {
      const curve = new CatmullRomCurve3([
        new Vector3(x0, 0.995, z0),
        new Vector3((x0 + x1) / 2, low, (z0 + z1) / 2),
        new Vector3(x1, 0.995, z1),
      ]);
      return new TubeGeometry(curve, 24, 0.012, 5, false);
    });
    const holoRing = new MeshBasicMaterial({ color: toColor(t.primary, 3), toneMapped: false });
    const holoShell = new MeshBasicMaterial({
      color: toColor(t.info, 2.2),
      toneMapped: false,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const holoLabel = new SpriteMaterial({
      map: tex(256, paintLabel(c, hologramLabel)),
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    holoLabel.color = toColor(t['primary-400'], flat ? 1 : 2.2);
    const beam = flat
      ? null
      : new ShaderMaterial({
          ...BEAM_SHADER,
          uniforms: {
            color: { value: new Color(1, 0.95, 0.85) },
            strength: { value: 0.075 },
          },
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
          fog: false,
        });
    // The cone opens toward -z from its apex at the lens
    const beamGeometry = new ConeGeometry(1.25, BEAM_LENGTH, 24, 1, true);
    beamGeometry.translate(0, -BEAM_LENGTH / 2, 0);
    beamGeometry.rotateX(Math.PI / 2);
    const dust = new PointsMaterial({
      color: toColor(c.muted, 1.2),
      size: 0.03,
      transparent: true,
      depthWrite: false,
    });
    return {
      c,
      t,
      accent,
      box,
      hidden,
      wallMaterials,
      floor,
      ceiling,
      door,
      rack,
      crate,
      strip,
      lamp,
      laser,
      cable,
      cables,
      holoRing,
      holoShell,
      holoLabel,
      beam,
      beamGeometry,
      dust,
      plane: new PlaneGeometry(1, 1),
      lampOn: toColor(c.light, flat ? 1 : 2.2),
      lampOff: toColor(c.light, 0.25),
      textures,
      fog: new FogExp2(toColor(c.dark), FOG_DENSITY),
      background: toColor(c.dark),
      ambient: toColor(c.dark).lerp(new Color(0.5, 0.6, 1), 0.5),
    };
    // The theme is read once (the page is inert while Game Mode is open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, W, H]);

  useEffect(
    () => () => {
      res.textures.forEach((texture) => texture.dispose());
      new Set([
        ...res.wallMaterials,
        res.floor,
        res.ceiling,
        res.door,
        res.rack,
        res.crate,
        res.strip,
        res.lamp,
        res.laser,
        res.cable,
        res.holoRing,
        res.holoShell,
        res.holoLabel,
        res.dust,
        ...(res.beam ? [res.beam] : []),
      ]).forEach((m) => m.dispose());
      res.cables.forEach((g) => g.dispose());
      [res.box, res.plane, res.beamGeometry].forEach((g) => g.dispose());
    },
    [res]
  );

  // Fog and the dark background (none in high contrast)
  useEffect(() => {
    const before = { fog: scene.fog, background: scene.background };
    scene.fog = flat ? null : res.fog;
    scene.background = flat ? toColor(res.c.dark) : res.background;
    invalidate();
    return () => {
      scene.fog = before.fog;
      scene.background = before.background;
    };
  }, [scene, res, flat, invalidate]);

  // The camera joins the scene, so the flashlight and the gauntlet can ride on it
  useEffect(() => {
    scene.add(camera);
    return () => {
      scene.remove(camera);
    };
  }, [scene, camera]);
  useLayoutEffect(() => {
    if (!spot.current || !spotTarget.current) return;
    spot.current.target = spotTarget.current;
    // Against acne on the walls it lights at a glancing angle
    spot.current.shadow.normalBias = 0.02;
  });

  // Static instances: walls, baseboard strips, racks, crates, lamps, the laser grid
  useLayoutEffect(() => {
    shell.forEach(({ x, z }, i) => {
      dummy.position.set(x + 0.5, 0.5, z + 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      walls.current.setMatrixAt(i, dummy.matrix);
    });
    walls.current.instanceMatrix.needsUpdate = true;
    walls.current.computeBoundingSphere();

    if (strips.current) {
      boards.forEach(([x, z, yaw, room], i) => {
        dummy.position.set(x, 0.025, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(1, 0.03, 0.02);
        dummy.updateMatrix();
        strips.current.setMatrixAt(i, dummy.matrix);
        strips.current.setColorAt(i, res.accent(room, 3.2));
      });
      strips.current.instanceMatrix.needsUpdate = true;
      strips.current.instanceColor.needsUpdate = true;
      strips.current.computeBoundingSphere();
    }

    RACKS.forEach(([x, z, yaw], i) => {
      dummy.position.set(x, RACK_SIZE[1] / 2, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(...RACK_SIZE);
      dummy.updateMatrix();
      rackMesh.current.setMatrixAt(i, dummy.matrix);
    });
    rackMesh.current.instanceMatrix.needsUpdate = true;
    rackMesh.current.computeBoundingSphere();

    CRATES.forEach(([x, z, s], i) => {
      dummy.position.set(x, s / 2, z);
      dummy.rotation.set(0, (i * 0.7) % 1, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      crateMesh.current.setMatrixAt(i, dummy.matrix);
    });
    crateMesh.current.instanceMatrix.needsUpdate = true;
    crateMesh.current.computeBoundingSphere();

    LAMPS.forEach(([x, z], i) => {
      dummy.position.set(x, 0.992, z);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.set(0.42, 0.18, 1);
      dummy.updateMatrix();
      lampMesh.current.setMatrixAt(i, dummy.matrix);
      lampMesh.current.setColorAt(i, res.lampOn);
    });
    lampMesh.current.instanceMatrix.needsUpdate = true;
    lampMesh.current.instanceColor.needsUpdate = true;
    lampMesh.current.computeBoundingSphere();

    const { z, x0, x1, heights, posts } = LASER_GRID;
    let i = 0;
    heights.forEach((y) => {
      dummy.position.set((x0 + x1) / 2, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(x1 - x0, 0.008, 0.008);
      dummy.updateMatrix();
      laserMesh.current.setMatrixAt(i, dummy.matrix);
      i += 1;
    });
    for (let p = 0; p <= posts; p += 1) {
      dummy.position.set(x0 + ((x1 - x0) * p) / posts, 0.5, z);
      dummy.scale.set(0.008, 1, 0.008);
      dummy.updateMatrix();
      laserMesh.current.setMatrixAt(i, dummy.matrix);
      i += 1;
    }
    laserMesh.current.instanceMatrix.needsUpdate = true;
    laserMesh.current.computeBoundingSphere();
    invalidate();
  }, [shell, boards, res, flat, invalidate]);

  // Blast doors: two halves per door, sliding into the walls on either side; dust when one opens
  const doorState = useRef({});
  const dustLive = useRef([]);
  const axes = useMemo(
    () => doorCells.map((cell) => doorAxis(cell, isFloor, W)),
    [doorCells, isFloor, W]
  );
  const spawnDust = (x, z) => {
    if (reduced || flat) return;
    const n = 36;
    const positions = new Float32Array(n * 3);
    const velocities = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      positions.set(
        [x + (Math.random() - 0.5) * 0.8, 0.03, z + (Math.random() - 0.5) * 0.3],
        i * 3
      );
      velocities.set(
        [(Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.45, (Math.random() - 0.5) * 0.6],
        i * 3
      );
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const points = new Points(geometry, res.dust.clone());
    points.frustumCulled = false;
    scene.add(points);
    dustLive.current.push({ points, velocities, age: 0 });
  };
  useEffect(
    () => () => {
      dustLive.current.forEach(({ points }) => {
        scene.remove(points);
        points.geometry.dispose();
        points.material.dispose();
      });
      dustLive.current = [];
    },
    [scene]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    clock.current += dt;
    const time = clock.current;
    let moving = false;

    // Doors
    const mesh = doorMesh.current;
    if (mesh) {
      let changed = false;
      doorCells.forEach((cell, i) => {
        const target = closedDoors[cell] ? 0 : 1;
        const was = doorState.current[cell];
        let open = was === undefined || reduced ? target : MathUtils.damp(was, target, 5, dt);
        if (Math.abs(open - target) < 0.003) open = target;
        if (was === open) return;
        if (was !== undefined && was < 0.02 && target === 1) {
          spawnDust((cell % W) + 0.5, Math.floor(cell / W) + 0.5);
        }
        doorState.current[cell] = open;
        const cx = (cell % W) + 0.5;
        const cz = Math.floor(cell / W) + 0.5;
        const alongX = axes[i] === 'x';
        // An eased slide, a little slower at the start, like a heavy door
        const slide = open * open * (3 - 2 * open) * 0.5;
        [-1, 1].forEach((side, h) => {
          const offset = side * (0.25 + slide);
          dummy.position.set(cx + (alongX ? offset : 0), 0.5, cz + (alongX ? 0 : offset));
          dummy.rotation.set(0, alongX ? 0 : Math.PI / 2, 0);
          dummy.scale.set(0.5, 1, DOOR_DEPTH);
          dummy.updateMatrix();
          mesh.setMatrixAt(i * 2 + h, dummy.matrix);
        });
        changed = true;
        moving ||= open !== target;
      });
      if (changed) mesh.instanceMatrix.needsUpdate = true;
    }

    // Dust from opened doors, freed after DUST_LIFE
    if (dustLive.current.length) {
      let kept = 0;
      dustLive.current.forEach((d) => {
        d.age += dt;
        if (d.age >= DUST_LIFE) {
          scene.remove(d.points);
          d.points.geometry.dispose();
          d.points.material.dispose();
          return;
        }
        const pos = d.points.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 1) {
          d.velocities[i * 3 + 1] -= 0.25 * dt;
          pos.array[i * 3] += d.velocities[i * 3] * dt;
          pos.array[i * 3 + 1] = Math.max(
            0.01,
            pos.array[i * 3 + 1] + d.velocities[i * 3 + 1] * dt
          );
          pos.array[i * 3 + 2] += d.velocities[i * 3 + 2] * dt;
        }
        pos.needsUpdate = true;
        d.points.material.opacity = 0.7 * (1 - d.age / DUST_LIFE);
        dustLive.current[kept] = d;
        kept += 1;
      });
      dustLive.current.length = kept;
      moving = true;
    }

    if (!reduced && !flat) {
      // Lamps that flicker (uploaded only when one changes), and the room light breathing
      const lamps = lampMesh.current;
      if (lamps) {
        let changed = false;
        LAMPS.forEach(([, , flickers], i) => {
          if (!flickers) return;
          const on = Math.sin(time * 23 + i * 7) + Math.sin(time * 3.1 + i) > -1.2;
          if (lampsOn.current[i] === on) return;
          lampsOn.current[i] = on;
          lamps.setColorAt(i, on ? res.lampOn : res.lampOff);
          changed = true;
        });
        if (changed) lamps.instanceColor.needsUpdate = true;
      }
      if (roomLight.current) roomLight.current.intensity = 2.2 + Math.sin(time * 1.7) * 0.25;
      // The racks' LEDs blink: their glow map steps along
      const glow = res.rack.userData.glow;
      if (glow) glow.offset.y = Math.floor(time * 4) * 0.13;
      // The vault's lasers pulse
      res.laser.opacity = 0.65 + Math.sin(time * 6) * 0.2;
      // The hologram turns
      if (holo.current) {
        holo.current.rotation.y = time * 0.6;
        holo.current.position.y = 0.48 + Math.sin(time * 1.3) * 0.03;
      }
    }

    // One fill light, for the room the player is in (lights cost every lit pixel, in range or not)
    const light = roomLight.current;
    if (light) {
      const room = roomAt(camera.position.x, camera.position.z) ?? 'about';
      if (room !== lit.current) {
        lit.current = room;
        const [x, z] = ROOM_LIGHTS.find(([, , id]) => id === room);
        light.position.set(x, 0.85, z);
        light.color.copy(res.accent(room, 1));
      }
    }

    // Chromatic aberration: a pulse from a shot or a hit, eased back
    if (aberration.current) {
      const fx = postFx.current;
      fx.aberration = MathUtils.damp(fx.aberration, 0, 6, dt);
      const k = reduced ? 0 : fx.aberration * 0.0035;
      aberration.current.offset.set(k, k * 0.6);
    }
    if (moving) state.invalidate();
  }, -1);

  return (
    <>
      <instancedMesh
        ref={walls}
        args={[res.box, res.wallMaterials, shell.length]}
        // Receive only: the flashlight is at the eye, so walls' own shadows fall out of sight
        receiveShadow
      />
      <instancedMesh
        ref={doorMesh}
        args={[res.box, res.door, doorCells.length * 2]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <mesh position={[W / 2, 0, H / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W + 2, H + 2]} />
        <primitive object={res.floor} attach='material' />
      </mesh>
      <mesh position={[W / 2, 1, H / 2]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W + 2, H + 2]} />
        <primitive object={res.ceiling} attach='material' />
      </mesh>
      {!flat && <instancedMesh ref={strips} args={[res.box, res.strip, boards.length]} />}
      <instancedMesh
        ref={rackMesh}
        args={[res.box, res.rack, RACKS.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={crateMesh}
        args={[res.box, res.crate, CRATES.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh ref={lampMesh} args={[res.plane, res.lamp, LAMPS.length]} />
      <instancedMesh
        ref={laserMesh}
        args={[res.box, res.laser, LASER_GRID.heights.length + LASER_GRID.posts + 1]}
      />
      {res.cables.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={res.cable} castShadow />
      ))}

      {/* The command hub's hologram: a base ring, a turning wire globe, and its name */}
      <group position={[HOLOGRAM[0], 0, HOLOGRAM[1]]}>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={res.holoRing}>
          <ringGeometry args={[0.3, 0.36, 40]} />
        </mesh>
        <group ref={holo} position={[0, 0.48, 0]}>
          <mesh material={res.holoShell}>
            <icosahedronGeometry args={[0.22, 1]} />
          </mesh>
          <mesh material={res.holoShell} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.004, 4, 48]} />
          </mesh>
        </group>
        <sprite material={res.holoLabel} position={[0, 0.85, 0]} scale={[0.9, 0.9, 1]} />
      </group>

      {!flat && (
        <>
          <ambientLight intensity={0.14} color={res.ambient} />
          <pointLight ref={roomLight} intensity={2.2} distance={7} decay={2} />
        </>
      )}

      {/* On the camera: the flashlight (the only shadow caster), its beam, and the gauntlet */}
      {createPortal(
        <>
          {!flat && (
            <>
              <object3D ref={spotTarget} position={[0.06, -0.08, -5]} />
              <spotLight
                ref={spot}
                position={LENS}
                angle={0.46}
                penumbra={0.55}
                intensity={16}
                distance={REACH}
                decay={1.5}
                color={FLASHLIGHT}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-bias={-0.0004}
                shadow-camera-near={0.1}
                shadow-camera-far={REACH}
              />
              <mesh
                geometry={res.beamGeometry}
                material={res.beam}
                position={LENS}
                rotation={[0.015, -0.012, 0]}
                renderOrder={10}
              />
            </>
          )}
          <Gauntlet weapon={weapon} motion={motion} reduced={reduced} flat={flat} colors={res.c} />
        </>,
        camera
      )}

      {!flat && <PostFx aberration={aberration} />}
    </>
  );
};

export default Facility;
