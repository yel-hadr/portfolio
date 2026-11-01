import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerformanceMonitor, PointerLockControls } from '@react-three/drei';
import {
  BoxGeometry,
  CanvasTexture,
  MathUtils,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  SRGBColorSpace,
} from 'three';

import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { styles } from '../../styles';
import { readTheme, rgb } from '../../utils/themeColors';
import ContactForm from '../ContactForm';
import ReleaseContext from '../canvas/ReleaseContext';
import { GameLayer } from './Enemies';
import { person } from '../../constans';
import { HIT_STOP_MS, frozen } from './freeze';
import { readGameTheme } from './gameTheme';
import {
  GameHud,
  GameInfo,
  MainMenu,
  MissionComplete,
  NpcDialogue,
  PauseMenu,
  SystemFailure,
} from './GameHud';
import { GAME_CUB } from './gameMap';
import { MAP_CUB, parseCub } from './map';
import {
  ENEMIES,
  GAME_PANELS,
  HUB,
  MOVE_SPEED,
  NPCS,
  PROP_BOXES,
  SECTIONS,
  THREAT_TYPES,
  WEAPON_COUNT,
  WEAPON_FX,
  roomAt,
} from './rooms';
import { useLiveRef } from '../../hooks/useLiveRef';

// Game Mode's look (lit materials, props, flashlight, post-processing): its own chunk, so the
// cub3D demo never loads it
const Facility = lazy(() => import('./Facility'));
// The sound synthesizer, loaded only once sound is turned on
const loadSfx = () => import('./sfx');

// A web homage to cub3D: the project's own map.cub as a first-person maze. The original casts
// one ray per screen column; here three.js draws the walls as boxes, and the minimap shows the
// rays, stepping from grid line to grid line as the original does. With `game` (Game Mode) it
// adds a HUD, the mission and the wall terminals, on Game Mode's own map (gameMap.js).

const EYE = 0.5; // walls are 1 high: the eye is halfway, as in a raycaster
const FOV = 60; // horizontal, the original's FOV_ANGLE
const TURN_SPEED = 3; // radians per second (the original: 0.05 per frame)
const REDUCED_TURN = Math.PI / 4; // with reduced motion, each arrow press turns one step
const RADIUS = 0.2; // how close the player gets to a wall
const MINIMAP_CELL = 6; // px
const MINIMAP_RAYS = 24;
const RADAR_CELL = 7; // px: Game Mode's tactical radar draws its whole map
const RADAR_CONE = 3; // cells: the length of the player's view cone on the radar
// Distance shading: three.js fog on the walls, floor and ceiling, from FOG_NEAR to black at FOG_FAR
const FOG_NEAR = 1.5;
const FOG_FAR = 14;
const AIM_RANGE = 8; // cells: how far away a wall panel can be opened (the cub3D demo), or the crew
// A threat counts as in the crosshair (and can be hit) only within the weapon's range; a Zero-Day
// only while the flashlight's beam shows it (Enemies.jsx eases `lit` from 0 to 1)
const targetable = (enemy) => enemy.alive && (!THREAT_TYPES[enemy.type].stealth || enemy.lit > 0.5);
// Game Mode's wall terminals answer only up close: the Press E prompt, E and a click all need this
const PANEL_RANGE = 2.5;
// cells: E talks to a crew member this close (they are seen, and named in the crosshair, further)
const TALK_RANGE = 3;
// Threats in the crosshair as far as the longest weapon reaches: past the weapon in hand's own
// `range` the HUD says it is out of range, and a shot falls short
const AIM_REACH = Math.max(...WEAPON_FX.map(({ range }) => range));
// Integrity: what each threat in reach takes a second, after a short wind-up once one is close
const HARM_RATE = 6;
const HARM_WINDUP_MS = 500;
// Energy starts to refill this long after the last shot
const REFILL_AFTER_MS = 150;
// The lit path to the next section: this many cells of it, from the player on
const GUIDE_LENGTH = 14;
const AIM_RADIUS = 0.9; // cells from a panel's center that still count as aiming at it
const STRIDE = 0.75; // cells walked per footstep sound
const ENEMY_RADIUS = 0.25; // cells from a threat's center that still count as a hit
const NPC_RADIUS = 0.3; // cells, the same for the crew
const DOOR_LABEL_RANGE = 2.5;
// The radar's legend: the same shapes as on the radar, so it does not rely on color alone
const RADAR_LEGEND = [
  {
    key: 'you',
    color: 'text-foreground',
    shape: <circle cx='5' cy='5' r='4' fill='currentColor' />,
  },
  {
    key: 'threats',
    color: 'text-danger',
    shape: <path d='M1.5 1.5l7 7m0-7l-7 7' stroke='currentColor' strokeWidth='2.5' />,
  },
  {
    key: 'leak',
    color: 'text-secondary',
    shape: (
      <path
        d='M5 1l4 8H1z'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinejoin='round'
      />
    ),
  },
  {
    key: 'crew',
    color: 'text-primary-400',
    shape: <path d='M5 0l5 5-5 5-5-5z' fill='currentColor' />,
  },
  {
    key: 'doors',
    color: 'text-info',
    shape: <rect x='1' y='1' width='8' height='8' fill='currentColor' />,
  },
  {
    key: 'doorsOpen',
    color: 'text-info',
    shape: (
      <rect
        x='1.5'
        y='1.5'
        width='7'
        height='7'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.5'
      />
    ),
  },
  {
    key: 'objective',
    color: 'text-success',
    shape: <circle cx='5' cy='5' r='3.6' fill='none' stroke='currentColor' strokeWidth='2' />,
  },
]; // cells: how close a closed door shows where it leads
const DOOR_REACH = [0.8, 1.6]; // cells ahead where E (or Space) finds a door
const TOAST_MS = 8000; // long enough to read the fact (it is also in the text-only mode)
// Canvas options, made once (R3F re-applies `gl` whenever it is a new object)
const GAME_DPR = [1, 1.5];
// Game Mode's resolution follows the frame rate (PerformanceMonitor), down to this: 44% fewer
// pixels than 1 at 1080p. The monitor's factor (0 to 1, in tenths) and its swings are kept for the
// session, so a world back from a demo starts where the last one was instead of learning it again
const LOW_DPR = 0.75;
const QUALITY_KEY = 'game-quality';
// Changes of direction (up after down, or down after up) before the resolution stays put. drei's
// own `flipflops` counts every step, an incline at the top included, so a fast GPU would "fall
// back" to the lowest resolution within seconds: the swings are counted here instead
const SWINGS = 3;
const readTuning = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(QUALITY_KEY));
    if (saved && saved.factor >= 0 && saved.factor <= 1) {
      return { factor: saved.factor, dir: saved.dir ?? 0, swings: saved.swings ?? 0 };
    }
  } catch {
    // Nothing saved, or storage blocked
  }
  return { factor: 1, dir: 0, swings: 0 };
};
// Quarter steps of DPR: each change resizes the canvas and the post-processing buffers
const quarter = (factor) => Math.round(factor * 4) / 4;
// The clock for timers, shots and the freeze frame, read only from handlers, effects and the frame
// loop (the compiler cannot tell every handler from render code)
const timeNow = () => performance.now();
// The first seconds of play compile shaders and size the shadow map: their hitches are not a
// slow GPU, so the frame rate is only watched after this
const WARMUP_MS = 2500;
const gameDpr = (quality) => {
  const top = Math.min(Math.max(window.devicePixelRatio || 1, GAME_DPR[0]), GAME_DPR[1]);
  return LOW_DPR + (top - LOW_DPR) * quality;
};
const DEMO_DPR = [1, 2];
// Transparent, composited without premultiplied alpha, like the page's 3D layer
const GAME_GL = {
  powerPreference: 'default',
  antialias: false,
  alpha: true,
  premultipliedAlpha: false,
};
const DEMO_GL = { powerPreference: 'default', alpha: true, premultipliedAlpha: false };
const CAMERA = { fov: 50, near: 0.05, far: 60 };
const CONTRAST_KEY = 'game-contrast';
const VOLUME_KEY = 'game-volume';
// The graphics tier ('low', 'medium' or 'high') and Reduce flashing ('1' or '0'; unset follows
// reduced motion), remembered per viewer
const GRAPHICS_KEY = 'game-graphics';
const FLASH_KEY = 'game-flashing';
const TIERS = ['low', 'medium', 'high'];
// Low is a fixed low resolution, High the screen's own (up to 2); Medium follows the frame rate
const tierDpr = (graphics, quality) => {
  if (graphics === 'low') return LOW_DPR;
  if (graphics === 'high') return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  return gameDpr(quality);
};
const saveTuning = (tune) => {
  try {
    sessionStorage.setItem(QUALITY_KEY, JSON.stringify(tune));
  } catch {
    // Storage blocked: the tuning holds for this world only
  }
};
const readSetting = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const saveSetting = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered: fine
  }
};
// Fills a HUD bar to `value` (0 to 100), only when its whole percent changes
const writeBar = (el, value) => {
  if (!el) return;
  const v = Math.round(value);
  if (el.dataset.value === String(v)) return;
  el.dataset.value = String(v);
  el.style.transform = `scaleX(${v / 100})`;
  el.dataset.low = String(v < 30);
  // Its number, beside the label
  const readout = el.closest('[data-meter]')?.querySelector('[data-readout]');
  if (readout) readout.textContent = `${v}%`;
};

const KEYS = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  KeyD: 'right',
  ArrowLeft: 'turnLeft',
  ArrowRight: 'turnRight',
};

// Wall boxes only where they can be seen: every non-floor cell next to (or diagonal to) a floor
// cell, so the enclosed area has no gaps whatever the map holds outside it
const shellCells = (isFloor, W, H) => {
  const cells = [];
  for (let z = -1; z <= H; z += 1) {
    for (let x = -1; x <= W; x += 1) {
      if (isFloor(x, z)) continue;
      let near = false;
      for (let dz = -1; dz <= 1 && !near; dz += 1) {
        for (let dx = -1; dx <= 1 && !near; dx += 1) {
          near = isFloor(x + dx, z + dz);
        }
      }
      if (near) cells.push({ x, z });
    }
  }
  return cells;
};

// A parsed .cub with what the hot paths need (movement, line of sight, minimap, radar): the
// grid's size (cell index is z * W + x), its floor test and the wall boxes. Made once per map
const makeWorld = (text) => {
  const parsed = parseCub(text);
  const { width: W, height: H, walkable, doors } = parsed;
  const isFloor = (x, z) => x >= 0 && z >= 0 && x < W && z < H && walkable[z * W + x] === 1;
  // Door cells side by side are one door (Game Mode's corridors are two cells wide): each cell's
  // whole door, so it opens and closes as one
  const doorSet = new Set(doors);
  const doorOf = {};
  doors.forEach((cell) => {
    if (doorOf[cell]) return;
    const group = [];
    const stack = [cell];
    while (stack.length) {
      const next = stack.pop();
      if (!doorSet.has(next) || group.includes(next)) continue;
      group.push(next);
      const x = next % W;
      if (x > 0) stack.push(next - 1);
      if (x < W - 1) stack.push(next + 1);
      stack.push(next - W, next + W);
    }
    group.forEach((member) => {
      doorOf[member] = group;
    });
  });
  return { ...parsed, W, H, isFloor, doorOf, shell: shellCells(isFloor, W, H) };
};
// The cub3D demo walks the repo's map.cub; Game Mode its own map
const DEMO_WORLD = makeWorld(MAP_CUB);
const GAME_WORLD = makeWorld(GAME_CUB);
// The distance along the view (yaw) to the nearest prop box ahead (a ray against each box), or
// Infinity
const propAlong = (x, z, dx, dz) => {
  let best = Infinity;
  PROP_BOXES.forEach(([x0, z0, x1, z1]) => {
    const tx0 = dx ? (x0 - x) / dx : -Infinity;
    const tx1 = dx ? (x1 - x) / dx : Infinity;
    const tz0 = dz ? (z0 - z) / dz : -Infinity;
    const tz1 = dz ? (z1 - z) / dz : Infinity;
    const near = Math.max(Math.min(tx0, tx1), Math.min(tz0, tz1));
    const far = Math.min(Math.max(tx0, tx1), Math.max(tz0, tz1));
    if (dx === 0 && (x < x0 || x > x1)) return;
    if (dz === 0 && (z < z0 || z > z1)) return;
    if (near <= far && far > 0) best = Math.min(best, Math.max(near, 0));
  });
  return best;
};
const propAhead = (x, z, yaw) => propAlong(x, z, -Math.sin(yaw), -Math.cos(yaw));
// A prop (a rack, a crate, the hub) between the player and a point: shots do not pass through
// Whether someone stands in a door's cell: the player's box (RADIUS round the eye) or a live threat
const doorwayTaken = (cell, W, camera, enemies) => {
  const x0 = cell % W;
  const z0 = Math.floor(cell / W);
  const overlaps = (x, z, r) => x + r > x0 && x - r < x0 + 1 && z + r > z0 && z - r < z0 + 1;
  if (camera && overlaps(camera.position.x, camera.position.z, RADIUS)) return true;
  return enemies.some((enemy) => enemy.alive && overlaps(enemy.x, enemy.z, ENEMY_RADIUS));
};

// 64x64 pixel-art textures, one per side as the subject requires, in the theme's colors.
// The names follow the textures map.cub points to.
const PAINTERS = {
  // CRATE_1D: planks with a cross brace
  NO: (ctx, c) => {
    ctx.fillStyle = rgb(c.primary);
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = rgb(c['on-primary'], 0.35);
    for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 2);
    ctx.strokeStyle = rgb(c['on-primary'], 0.6);
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 58, 58);
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(58, 58);
    ctx.stroke();
  },
  // BRICK_6D: staggered bricks
  SO: (ctx, c) => {
    ctx.fillStyle = rgb(c.background);
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = rgb(c.secondary);
    for (let row = 0; row < 8; row += 1) {
      const offset = row % 2 ? 8 : 0;
      for (let x = -16; x < 64; x += 16) ctx.fillRect(x + offset + 1, row * 8 + 1, 14, 6);
    }
  },
  // CONSOLE_1B: a panel of screens
  WE: (ctx, c) => {
    ctx.fillStyle = rgb(c.tertiary);
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = rgb(c.background, 0.85);
    ctx.fillRect(6, 6, 52, 24);
    ctx.fillStyle = rgb(c.info);
    for (let i = 0; i < 4; i += 1) ctx.fillRect(10, 10 + i * 5, 12 + ((i * 17) % 30), 2);
    ctx.fillStyle = rgb(c.background, 0.6);
    for (let x = 8; x < 58; x += 10) ctx.fillRect(x, 38, 6, 6);
    ctx.fillRect(6, 50, 52, 6);
  },
  // PIPES_1A: vertical pipes
  EA: (ctx, c) => {
    ctx.fillStyle = rgb(c['surface-raised']);
    ctx.fillRect(0, 0, 64, 64);
    for (let x = 4; x < 64; x += 15) {
      ctx.fillStyle = rgb(c.success);
      ctx.fillRect(x, 0, 9, 64);
      ctx.fillStyle = rgb(c.background, 0.35);
      ctx.fillRect(x + 6, 0, 3, 64);
      ctx.fillRect(x - 1, 20, 11, 4);
      ctx.fillRect(x - 1, 44, 11, 4);
    }
  },
  // DOOR_1C: a framed door
  D: (ctx, c) => {
    ctx.fillStyle = rgb(c.danger);
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = rgb(c.background, 0.5);
    ctx.fillRect(0, 0, 64, 4);
    ctx.fillRect(0, 0, 4, 64);
    ctx.fillRect(60, 0, 4, 64);
    ctx.fillRect(30, 4, 4, 60);
    ctx.fillRect(40, 30, 6, 6);
  },
};

const makeTexture = (painter, colors, letter) => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  painter(ctx, colors);
  if (letter) {
    // The side's name, so the four textures are told apart without relying on color
    ctx.fillStyle = rgb(colors.background, 0.8);
    ctx.fillRect(2, 2, 14, 14);
    ctx.fillStyle = rgb(colors.foreground);
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 9, 9.5);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
};

const COLOR_NAMES = [
  'primary',
  'on-primary',
  'secondary',
  'tertiary',
  'info',
  'success',
  'danger',
  'background',
  'surface-raised',
  'foreground',
];

// Every door starts closed: { [cell]: true while closed }
const allClosed = (cells) => Object.fromEntries(cells.map((cell) => [cell, true]));

// The panels on the walls of the large north-east room (map rows 1-4): position just off a wall
// face, and the yaw that faces the room
const PANELS = [
  { id: 'welcome', position: [26.5, 0.55, 1.02], yaw: 0 },
  { id: 'about', position: [22.5, 0.55, 1.02], yaw: 0 },
  { id: 'skills', position: [31.98, 0.55, 2.5], yaw: -Math.PI / 2 },
  { id: 'projects', position: [23.5, 0.55, 4.98], yaw: Math.PI },
];
const PANEL_STEP = 0.1; // line-of-sight sampling, in cells

// Where a closed door leads, floating on it. Announced as well, so hidden from assistive tech
// here. Its own component: a new label does not re-render Scene and its panels' Html roots
const DoorLabel = memo(function DoorLabel({ label }) {
  if (!label) return null;
  return (
    <Html
      key={label.cell}
      center
      position={[label.x + 0.5, 0.85, label.z + 0.5]}
      zIndexRange={[25, 0]}
      pointerEvents='none'
    >
      <p
        aria-hidden='true'
        className='select-none text-nowrap rounded-md border-2 border-info bg-background/90 px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wider text-foreground'
      >
        {label.text}
      </p>
    </Html>
  );
});

/** The world inside the Canvas: walls, door, floor and ceiling, movement and the panels */
// Memoized: HUD state (the aimed wall, the open dialog) re-renders the HUD, not the 3D tree and
// its four Html roots
const Scene = memo(function Scene({
  world,
  input,
  lookedRef,
  solid,
  doorCells,
  closedDoors,
  panels,
  onMove,
  lockable,
  lockRef,
  onLockChange,
  spawn,
  reduced,
  facility,
  flat,
  weapon,
  motion,
  postFx,
  hologramLabel,
  discovered,
  targetRef,
  guideRef,
  noFlash,
  graphics,
  slow,
  hitStop,
  respawnRef,
  hubLitRef,
  nearRef,
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // R3F's live state: effects move the camera through it (the frame loop through its own state)
  const get = useThree((s) => s.get);
  const eyeRef = useLiveRef(camera);
  const walls = useRef(null);
  const doorMesh = useRef(null);
  // Each door's height, eased between 1 (closed) and 0 (sunk into the floor)
  const doorHeights = useRef({});
  const panelEls = useRef({});
  // The panels within fog range: only those are mounted (a transformed drei Html restyles itself
  // every frame, so far-off panels would cost DOM work for nothing)
  const [near, setNear] = useState(() => new Set());
  const moving = useRef(false);
  const { W, H, isFloor, shell } = world;

  // GPU resources made here are not owned by R3F (they are passed as args), so they are freed
  // on unmount below
  const resources = useMemo(() => {
    // Game Mode draws its own world (Facility)
    if (facility) return null;
    const colors = readTheme(COLOR_NAMES);
    const tex = Object.fromEntries(
      Object.keys(PAINTERS).map((side) => [
        side,
        makeTexture(PAINTERS[side], colors, side === 'D' ? '' : side[0]),
      ])
    );
    // The top and bottom faces are never seen (walls span floor to ceiling): not drawn at all
    const hidden = new MeshBasicMaterial({ visible: false });
    const face = (side) => new MeshBasicMaterial({ map: tex[side] });
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z. A +x face is seen looking west, so it takes the
    // WE texture, as the original's raycaster picks it from the ray's direction
    const wallMaterials = [face('WE'), face('EA'), hidden, hidden, face('NO'), face('SO')];
    const door = face('D');
    const box = new BoxGeometry(1, 1, 1);
    // Far walls fade to the darker of the theme's background and foreground
    const sum = (channels) => channels.split(' ').reduce((a, v) => a + Number(v), 0);
    const fog =
      sum(colors.background) < sum(colors.foreground) ? colors.background : colors.foreground;
    return { tex, wallMaterials, door, box, fog: `rgb(${fog.split(' ').join(',')})` };
  }, [facility]);

  useEffect(
    () => () => {
      if (!resources) return;
      const { tex, wallMaterials, door, box } = resources;
      Object.values(tex).forEach((t) => t.dispose());
      new Set([...wallMaterials, door]).forEach((m) => m.dispose());
      box.dispose();
    },
    [resources]
  );

  useLayoutEffect(() => {
    if (!walls.current) return;
    const dummy = new Object3D();
    shell.forEach(({ x, z }, i) => {
      dummy.position.set(x + 0.5, 0.5, z + 0.5);
      dummy.updateMatrix();
      walls.current.setMatrixAt(i, dummy.matrix);
    });
    walls.current.instanceMatrix.needsUpdate = true;
    walls.current.computeBoundingSphere();
  }, [shell]);

  // The player starts where map.cub puts N, facing north (or where Game Mode left off)
  const placeAtSpawn = useEffectEvent(() => {
    const { x, z, yaw } = spawn ?? world.player;
    const eye = get().camera;
    eye.rotation.order = 'YXZ';
    eye.position.set(x, EYE, z);
    eye.rotation.set(0, yaw, 0);
    onMove(eye);
    // The first frame may already have been drawn from the default camera
    invalidate();
  });
  // Once
  useLayoutEffect(() => {
    placeAtSpawn();
  }, []);
  // What is left to turn (Game Mode's mouse look, below)
  const yawPending = useRef(0);
  // Game Mode's Reboot: back where the map puts N, facing north, with no turn left to make
  useEffect(() => {
    if (!respawnRef) return undefined;
    respawnRef.current = () => {
      const { x, z, yaw } = world.player;
      camera.position.set(x, EYE, z);
      camera.rotation.set(0, yaw, 0);
      yawPending.current = 0;
      onMove(camera);
      invalidate();
    };
    return () => {
      respawnRef.current = null;
    };
  }, [respawnRef, world, camera, onMove, invalidate]);

  // three.js takes a vertical FOV: derive it from the original's 60° horizontal one
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const eye = get().camera;
    eye.fov = (2 * Math.atan(Math.tan((FOV * Math.PI) / 360) / aspect) * 180) / Math.PI;
    eye.near = 0.05;
    eye.updateProjectionMatrix();
    invalidate();
  }, [camera, get, size, invalidate]);

  const blocked = (x, z) => solid(Math.floor(x), Math.floor(z));
  // Game Mode's racks and crates are in the way too
  const onProp = (x, z) =>
    facility &&
    PROP_BOXES.some(
      ([x0, z0, x1, z1]) => x > x0 - RADIUS && x < x1 + RADIUS && z > z0 - RADIUS && z < z1 + RADIUS
    );
  const free = (x, z) =>
    !blocked(x - RADIUS, z - RADIUS) &&
    !blocked(x + RADIUS, z - RADIUS) &&
    !blocked(x - RADIUS, z + RADIUS) &&
    !blocked(x + RADIUS, z + RADIUS) &&
    !onProp(x, z);

  // Game Mode's mouse look: the mouse adds to the turn still to make and the view eases through
  // it, a little inertia (the controls themselves only capture the mouse). Instant with reduced
  // motion. It is kept as what is left to turn, not as a target angle: the controls fold the
  // camera's angle back into ±PI on every mousemove, so a target past PI would turn the long way
  useEffect(() => {
    if (!facility || !lockable) return undefined;
    const onMouse = (e) => {
      if (document.pointerLockElement !== gl.domElement) return;
      yawPending.current -= e.movementX * 0.002;
      lookedRef.current = true;
      invalidate();
    };
    document.addEventListener('mousemove', onMouse);
    return () => document.removeEventListener('mousemove', onMouse);
  }, [facility, lockable, gl, lookedRef, invalidate]);

  // Walls hide the panels: a walk along the grid from the eye to each panel, far cheaper than
  // drei's occlude (raycasts against every wall instance, every frame)
  const inSight = (tx, tz) => {
    const { x, z } = camera.position;
    const steps = Math.ceil(Math.hypot(tx - x, tz - z) / PANEL_STEP);
    for (let i = 1; i < steps; i += 1) {
      if (blocked(x + ((tx - x) * i) / steps, z + ((tz - z) * i) / steps)) return false;
    }
    return true;
  };
  // Only when the player moved or a door changed (not on turns), and only the values that changed.
  // After the movement loop, before drei's Html (priority 0), so the panels track this frame
  const seen = useRef({ x: NaN, z: NaN, doors: null, near: '' });
  useFrame(() => {
    // Game Mode's facility mounts its own terminals in the walls
    if (facility) return;
    const { x, z } = camera.position;
    const last = seen.current;
    if (x === last.x && z === last.z && last.doors === closedDoors) return;
    Object.assign(last, { x, z, doors: closedDoors });
    let inRange = '';
    panels.forEach(({ id, position: [px, , pz] }) => {
      // The DOM panels take no fog: they fade with distance as the walls darken, in 32 steps
      const far = (Math.hypot(px - x, pz - z) - FOG_NEAR) / (FOG_FAR - FOG_NEAR);
      if (far < 1) inRange += `${id} `;
      const el = panelEls.current[id];
      if (!el) return;
      const visibility = far < 1 && inSight(px, pz) ? '' : 'hidden';
      const opacity = String(Math.round(Math.min(1, Math.max(0.15, 1 - far)) * 32) / 32);
      if (el.style.visibility !== visibility) el.style.visibility = visibility;
      if (visibility === '' && el.style.opacity !== opacity) el.style.opacity = opacity;
    });
    if (inRange !== last.near) {
      last.near = inRange;
      setNear(new Set(inRange.split(' ')));
      // Panels mounted by this get their visibility on the next frame
      last.x = NaN;
      invalidate();
    }
  }, -1);

  // Doors slide down into the floor as they open (and back up), unless motion is reduced; one
  // instanced mesh for all of them, updated only while one moves
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state, delta) => {
    const mesh = doorMesh.current;
    if (!mesh) return;
    let changed = false;
    let moving = false;
    doorCells.forEach((cell, i) => {
      const target = closedDoors[cell] ? 1 : 0;
      const now = doorHeights.current[cell];
      let next =
        now === undefined || reduced
          ? target
          : MathUtils.damp(now, target, 9, Math.min(delta, 1 / 30));
      if (Math.abs(next - target) < 0.01) next = target;
      if (next === now) return;
      doorHeights.current[cell] = next;
      dummy.position.set((cell % W) + 0.5, next / 2, Math.floor(cell / W) + 0.5);
      dummy.scale.set(1, Math.max(next, 0.0001), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      changed = true;
      moving = moving || next !== target;
    });
    if (changed) mesh.instanceMatrix.needsUpdate = true;
    if (moving) state.invalidate();
  }, -1);

  // Held keys move the player; demand mode renders only while something moves. A kill's freeze
  // frame holds the player too
  useFrame((state, delta) => {
    const held = input.current;
    const eye = eyeRef.current;
    if (frozen(hitStop)) {
      // On demand (reduced motion) the frames must keep coming for the walk to resume
      if (held.size || yawPending.current) state.invalidate();
      return;
    }
    if (!held.size && !lookedRef.current && !yawPending.current) {
      moving.current = false;
      return;
    }
    // In demand mode the first frame's delta spans the whole pause before it: one step instead
    const dt = moving.current ? Math.min(delta, 0.1) : 1 / 60;
    moving.current = true;
    if (yawPending.current) {
      const left = yawPending.current;
      // The same easing as MathUtils.damp, applied to what is left to turn
      const step = reduced || Math.abs(left) < 1e-4 ? left : left * (1 - Math.exp(-20 * dt));
      eye.rotation.y += step;
      yawPending.current = left - step;
      if (yawPending.current) state.invalidate();
    }
    let turn = 0;
    let forward = 0;
    let strafe = 0;
    held.forEach((code) => {
      const action = KEYS[code];
      if (action === 'turnLeft') turn = 1;
      else if (action === 'turnRight') turn = -1;
      else if (action === 'forward') forward = 1;
      else if (action === 'back') forward = -1;
      else if (action === 'left') strafe = -1;
      else if (action === 'right') strafe = 1;
    });
    // With reduced motion, turning happens in steps on key press (onKeyDown), not smoothly
    if (turn && !reduced) eye.rotation.y += turn * TURN_SPEED * dt;
    if (forward || strafe) {
      const yaw = eye.rotation.y;
      // A Memory Leak close by slows the player down (`slow`, 1 when none is)
      const step = (reduced ? MOVE_SPEED / 2 : MOVE_SPEED) * (slow?.current ?? 1) * dt;
      const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * step;
      const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * step;
      // Each axis on its own, so the player slides along a wall instead of stopping dead
      if (free(eye.position.x + dx, eye.position.z)) eye.position.x += dx;
      if (free(eye.position.x, eye.position.z + dz)) eye.position.z += dz;
    }
    lookedRef.current = false;
    onMove(eye);
    if (held.size) state.invalidate();
  }, -2);

  // Stable handlers: drei re-subscribes the controls whenever they change
  const onLook = useCallback(() => {
    lookedRef.current = true;
  }, [lookedRef]);
  const onLock = useCallback(() => onLockChange(true), [onLockChange]);
  const onUnlock = useCallback(() => onLockChange(false), [onLockChange]);

  return (
    <>
      {facility ? (
        <Suspense fallback={null}>
          <Facility
            shell={shell}
            isFloor={isFloor}
            W={W}
            H={H}
            doorCells={doorCells}
            closedDoors={closedDoors}
            reduced={reduced}
            flat={flat}
            weapon={weapon}
            motion={motion}
            postFxRef={postFx}
            hologramLabel={hologramLabel}
            panels={panels}
            discovered={discovered}
            targetRef={targetRef}
            guideRef={guideRef}
            noFlash={noFlash}
            graphics={graphics}
            hitStopRef={hitStop}
            hubLitRef={hubLitRef}
            nearRef={nearRef}
          />
        </Suspense>
      ) : (
        <>
          <fog attach='fog' args={[resources.fog, FOG_NEAR, FOG_FAR]} />
          <instancedMesh
            ref={walls}
            args={[resources.box, resources.wallMaterials, shell.length]}
          />
          <instancedMesh
            ref={doorMesh}
            args={[resources.box, resources.door, doorCells.length]}
            // Its instances move: no bounding sphere to cull by
            frustumCulled={false}
          />
          {/* Flat floor and ceiling colors, the F and C lines of map.cub */}
          <mesh position={[W / 2, 0, H / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W + 2, H + 2]} />
            <meshBasicMaterial color={`rgb(${world.floor.join(',')})`} />
          </mesh>
          <mesh position={[W / 2, 1, H / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W + 2, H + 2]} />
            <meshBasicMaterial color={`rgb(${world.ceiling.join(',')})`} />
          </mesh>
        </>
      )}
      {!facility &&
        panels
          .filter(({ id }) => near.has(id))
          .map(({ id, position, yaw, title, lines }) => (
            <Html
              key={id}
              ref={(el) => {
                panelEls.current[id] = el;
                // A panel just mounted gets its visibility (behind a wall or a door?) next frame
                if (el) {
                  seen.current.x = NaN;
                  invalidate();
                }
              }}
              transform
              position={position}
              rotation={[0, yaw, 0]}
              distanceFactor={1.6}
              zIndexRange={[20, 0]}
              pointerEvents='none'
            >
              {/* A separate React root: strings come in as props and render as text. Hidden from
              assistive tech: the same text is in "Read the walls", reachable from anywhere */}
              <div
                aria-hidden='true'
                className='w-96 select-none rounded-2xl border border-line-strong bg-background/90 p-5 text-foreground'
              >
                <p className='text-2xl font-black text-primary-400'>{title}</p>
                {lines.map((line) => (
                  <p key={line} className='mt-2 text-base leading-snug'>
                    {line}
                  </p>
                ))}
              </div>
            </Html>
          ))}
      {lockable && (
        // Horizontal mouse look only, like the original (polar angle pinned to the horizon).
        // The selector matches nothing: the buttons call lock() through lockRef, so a click
        // anywhere else (the close button) never captures the mouse
        <PointerLockControls
          ref={lockRef}
          selector='[data-cub3d-lock]'
          // Game Mode turns the view itself (with inertia, above); the controls capture the mouse
          pointerSpeed={facility ? 0 : 1}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
          onLock={onLock}
          onUnlock={onUnlock}
          onChange={onLook}
        />
      )}
      <ReleaseContext />
    </>
  );
});

// Casts the minimap's rays: steps from one grid line to the next until a wall (a DDA)
const castRay = (x, z, angle, solid) => {
  const dx = -Math.sin(angle);
  const dz = -Math.cos(angle);
  let cx = Math.floor(x);
  let cz = Math.floor(z);
  const stepX = dx < 0 ? -1 : 1;
  const stepZ = dz < 0 ? -1 : 1;
  const deltaX = Math.abs(1 / dx);
  const deltaZ = Math.abs(1 / dz);
  let sideX = dx === 0 ? Infinity : (dx < 0 ? x - cx : cx + 1 - x) * deltaX;
  let sideZ = dz === 0 ? Infinity : (dz < 0 ? z - cz : cz + 1 - z) * deltaZ;
  // The distance to the grid line crossed last (an axis the ray runs along never gets one)
  let dist = 0;
  for (let i = 0; i < 64; i += 1) {
    if (sideX < sideZ) {
      dist = sideX;
      sideX += deltaX;
      cx += stepX;
    } else {
      dist = sideZ;
      sideZ += deltaZ;
      cz += stepZ;
    }
    if (solid(cx, cz)) break;
  }
  return [x + dx * dist, z + dz * dist];
};

// What is in the crosshair: the nearest live threat (within the weapon's `reach`) or crew member
// on the view's center line, closer than the wall it meets, else the panel hanging where that line
// meets the wall. Returns an id or null
const aimAt = (
  camera,
  solid,
  panels,
  enemies,
  npcs = [],
  panelRange = AIM_RANGE,
  reach = AIM_RANGE,
  objects = []
) => {
  const { x, z } = camera.position;
  const yaw = camera.rotation.y;
  const [hx, hz] = castRay(x, z, yaw, solid);
  const wall = Math.hypot(hx - x, hz - z);
  const dx = -Math.sin(yaw);
  const dz = -Math.cos(yaw);
  let hit = null;
  let nearest = Math.min(wall, Math.max(reach, AIM_RANGE));
  // `cone` widens the hit with distance: a thing about 30° off the line still counts (the hub)
  // Threats and the crew behind a prop are hidden by it (the hub is a prop itself: not for it)
  const prop = propAlong(x, z, dx, dz);
  const consider = (thing, radius, limit, cone = 0, block = Infinity) => {
    const ex = thing.x - x;
    const ez = thing.z - z;
    const along = ex * dx + ez * dz;
    if (along <= 0 || along >= nearest || along >= limit || along >= block) return;
    if (Math.abs(ex * dz - ez * dx) >= Math.max(radius, along * cone)) return;
    hit = thing.id;
    nearest = along;
  };
  enemies.forEach((enemy) => targetable(enemy) && consider(enemy, ENEMY_RADIUS, reach, 0, prop));
  npcs.forEach((npc) => consider(npc, NPC_RADIUS, AIM_RANGE, 0, prop));
  // Things that stand in a room and answer like a terminal (the command hub): within panel range
  objects.forEach((object) => consider(object, object.radius, panelRange, object.cone));
  if (hit || wall > panelRange) return hit;
  const panel = panels.find(
    ({ position: [px, , pz] }) => Math.hypot(hx - px, hz - pz) < AIM_RADIUS
  );
  return panel ? panel.id : null;
};

// Clear grid line of sight between two points (cells), stepping 0.1 cell
const clearLine = (x, z, tx, tz, solid) => {
  const steps = Math.ceil(Math.hypot(tx - x, tz - z) / 0.1);
  for (let i = 1; i < steps; i += 1) {
    if (solid(Math.floor(x + ((tx - x) * i) / steps), Math.floor(z + ((tz - z) * i) / steps)))
      return false;
  }
  return true;
};
// The blaster's cone: every live threat within `cone` radians of the view and `range` cells, in
// line of sight
const inCone = (camera, enemies, solid, { cone, range }) => {
  const { x, z } = camera.position;
  const yaw = camera.rotation.y;
  return enemies.filter((enemy) => {
    if (!targetable(enemy)) return false;
    const d = Math.hypot(enemy.x - x, enemy.z - z);
    const bearing = Math.atan2(-(enemy.x - x), -(enemy.z - z));
    const off = Math.abs(MathUtils.euclideanModulo(bearing - yaw + Math.PI, 2 * Math.PI) - Math.PI);
    if (d >= range || off >= cone || !clearLine(x, z, enemy.x, enemy.z, solid)) return false;
    return propAlong(x, z, (enemy.x - x) / d, (enemy.z - z) / d) >= d;
  });
};

const HEADINGS = ['north', 'west', 'south', 'east'];
const headingOf = (yaw) =>
  HEADINGS[Math.round(((yaw % (2 * Math.PI)) + 2 * Math.PI) / (Math.PI / 2)) % 4];

// The touch pad: [key code, action, glyph, grid cell]
const TOUCH_MOVES = [
  ['KeyW', 'forward', '▲', 'col-start-2'],
  ['ArrowLeft', 'turnLeft', '↺', 'col-start-1 row-start-2'],
  ['KeyS', 'back', '▼', 'col-start-2 row-start-2'],
  ['ArrowRight', 'turnRight', '↻', 'col-start-3 row-start-2'],
  ['KeyA', 'left', '◀', 'col-start-1 row-start-3'],
  ['KeyD', 'right', '▶', 'col-start-3 row-start-3'],
];
const TOUCH_BUTTON = `inline-flex h-12 w-12 select-none items-center justify-center rounded-xl border border-line-strong bg-glass text-lg font-bold text-foreground backdrop-blur-md [touch-action:none] ${styles.hudFocus}`;

// Panels that open something else than their own text (Game Mode's rooms.js), and the command hub
const KIND = {
  ...Object.fromEntries(GAME_PANELS.map(({ id, kind }) => [id, kind])),
  [HUB.id]: HUB.kind,
};
// What else the crosshair can find in Game Mode, standing in a room (aimAt's `objects`)
const HUB_OBJECTS = [HUB];
// The weapon's motion at rest (GameMotion and the viewmodel read every field): a shot sets `kick`,
// which `recoil` springs toward and back; `eject` counts shots that throw a shell
const restMotion = () => ({
  recoil: 0,
  kick: 0,
  shake: 0,
  flash: 0,
  bobX: 0,
  bobY: 0,
  sway: 0,
  eject: 0,
});
const panelTitle = (t, id, game) => {
  if (!game) return t(`demos.cub3d.panels.${id}`);
  return t(KIND[id] === 'section' ? `demos.game.sections.${id}` : `demos.game.panels.${id}`);
};
const NPC_IDS = new Set(NPCS.map(({ id }) => id));
// The line above a dossier's title: which section of the profile it is, or the hub's briefing
const dossierKicker = (t, id, game) => {
  if (!game) return null;
  if (KIND[id] === 'section') {
    return t('demos.game.dossier', { number: SECTIONS.indexOf(id) + 1, total: SECTIONS.length });
  }
  return KIND[id] === 'hub' ? t('demos.game.hub.kicker') : null;
};
// The command hub's dossier: the owner's briefing, the mission's progress (live, from the sections
// read so far, the next one marked), the controls, and where to find the owner
const hubDetail = (t, sections, keys) => {
  const next = sections.find(({ found }) => !found)?.id;
  return {
    lines: [t('demos.game.story'), t('demos.game.objective')],
    checklist: {
      heading: t('demos.game.hub.progress'),
      items: sections.map(({ id, title, found }) => ({ id, title, found, next: id === next })),
      found: t('demos.game.mission.discovered'),
      notYet: t('demos.game.mission.notYet'),
      next: t('demos.game.mission.next'),
    },
    controls: { heading: t('demos.game.hub.controls'), items: keys },
    linksHeading: t('demos.game.hub.links'),
    links: [
      { href: person.resume, label: t('demos.game.mission.resume') },
      { href: person.github, label: t('demos.game.links.github') },
      { href: person.linkedin, label: t('demos.game.links.linkedin') },
    ],
  };
};
// What the crosshair is on (a threat, a crew member or a panel id), as the HUD shows and
// announces it
const aimText = (t, enemies, id) => {
  const enemy = enemies.find((e) => e.id === id);
  if (enemy) return t('demos.game.aimEnemy', { name: t(`demos.game.enemies.${enemy.type}`) });
  if (NPC_IDS.has(id)) return t('demos.game.aimNpc', { name: t(`demos.game.npcs.${id}.name`) });
  return t('demos.game.aimPanel', { name: panelTitle(t, id, true) });
};
// The cell in front of a wall panel, where the lit path leads
const panelCell = ({ position: [px, , pz], yaw }) => [
  Math.floor(px + Math.sin(yaw) * 0.5),
  Math.floor(pz + Math.cos(yaw) * 0.5),
];
const SECTION_PANELS = Object.fromEntries(
  GAME_PANELS.filter(({ kind }) => kind === 'section').map((panel) => [panel.id, panel])
);
// Game Mode's floor cells a prop (a rack, a crate, the hub) stands in: their center is inside the
// prop's box grown by the player's radius, so the player cannot walk through them
const blockedCells = (boxes, W) => {
  const cells = new Set();
  boxes.forEach(([x0, z0, x1, z1]) => {
    for (let z = Math.floor(z0 - RADIUS); z <= Math.floor(z1 + RADIUS); z += 1) {
      for (let x = Math.floor(x0 - RADIUS); x <= Math.floor(x1 + RADIUS); x += 1) {
        const cx = x + 0.5;
        const cz = z + 0.5;
        if (cx > x0 - RADIUS && cx < x1 + RADIUS && cz > z0 - RADIUS && cz < z1 + RADIUS) {
          cells.add(z * W + x);
        }
      }
    }
  });
  return cells;
};
// The shortest walk between two cells (doors count as open: the player opens them on the way),
// as a list of cells from the first to the last; null if none. `blocked` cells (props) are walked
// around, except the start and the goal; if they cut every way through, the walk ignores them
const findPath = (world, [sx, sz], [tx, tz], blocked = null) => {
  const { W, H, isFloor } = world;
  const start = sz * W + sx;
  const goal = tz * W + tx;
  if (!isFloor(sx, sz) || !isFloor(tx, tz)) return null;
  const from = new Int32Array(W * H).fill(-1);
  from[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length && from[goal] < 0; head += 1) {
    const cell = queue[head];
    const x = cell % W;
    const z = Math.floor(cell / W);
    [
      [x + 1, z],
      [x - 1, z],
      [x, z + 1],
      [x, z - 1],
    ].forEach(([nx, nz]) => {
      const next = nz * W + nx;
      const free = !blocked || next === goal || !blocked.has(next);
      if (isFloor(nx, nz) && free && from[next] < 0) {
        from[next] = cell;
        queue.push(next);
      }
    });
  }
  if (from[goal] < 0) return blocked ? findPath(world, [sx, sz], [tx, tz]) : null;
  const path = [];
  for (let cell = goal; cell !== start; cell = from[cell]) path.push(cell);
  path.push(start);
  return path.reverse();
};
// The cells Game Mode's props stand in, which the lit path walks around
const PROP_CELLS = blockedCells(PROP_BOXES, GAME_WORLD.W);
// The mission's clock (D1): `total` ms played before, plus the stretch running since `since`
// (null while the game is held: the menu, a dialog, a crew member talking, the pause menu)
const clockElapsed = ({ total, since }) => total + (since === null ? 0 : timeNow() - since);
// m:ss
const minutes = (ms) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
// The rooms on either side of each of Game Mode's doors; one joining two rooms gets a title (where
// it leads)
const DOOR_ROOMS = new Map(
  GAME_WORLD.doors.map((cell) => {
    const { W, isFloor } = GAME_WORLD;
    const x = cell % W;
    const z = Math.floor(cell / W);
    const sides = [
      [x + 1, z],
      [x - 1, z],
      [x, z + 1],
      [x, z - 1],
    ].filter(([sx, sz]) => isFloor(sx, sz));
    const rooms = new Set(sides.map(([sx, sz]) => roomAt(sx + 0.5, sz + 0.5)).filter(Boolean));
    return [cell, [...rooms]];
  })
);

/**
 * The cub3D demo: the canvas, minimap, HUD, welcome card and touch controls. In Game Mode
 * (`game`), the FPS game over the same map: rooms (rooms.js), threats, weapons and the HUD.
 * `details` holds what each info panel opens into; a terminal hands the game to a live demo
 * through `onOpenDemo(id, snapshot)` and the text-only mode through `onTextMode(snapshot)`, and
 * `initialState` (a snapshot) brings the game back where it was.
 */
const Cub3DWorld = ({
  t,
  technologies,
  projects,
  game = false,
  details,
  techIcons,
  initialState,
  onOpenDemo,
  onTextMode,
  onExit,
  onRestart,
  autostart = false,
  rerun = false,
}) => {
  const touch = useMediaQuery('(pointer: coarse)');
  const reduced = usePrefersReducedMotion();
  const lockable = !touch && 'exitPointerLock' in document;
  const world = game ? GAME_WORLD : DEMO_WORLD;
  const { W, H, walkable: WALKABLE, isFloor } = world;
  let keysKey = 'demos.cub3d.welcome.keys';
  if (game) keysKey = touch ? 'demos.game.keysTouch' : 'demos.game.keys';
  else if (touch) keysKey = 'demos.cub3d.welcome.keysTouch';
  // A snapshot, or Restart from the pause menu, skips the main menu
  const [started, setStarted] = useState(!!initialState || autostart);
  // Game Mode's main menu: 'menu', 'story' (Play) or 'info'
  const [screen, setScreen] = useState('menu');
  // For the frame loop's aim: nothing is announced while the briefing covers the view
  const startedRef = useLiveRef(started);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('');
  const wrapperRef = useRef(null);
  const minimapRef = useRef(null);
  const staticLayer = useRef(null);
  const radarRef = useRef(null);
  const radarLayer = useRef(null);
  const radarDue = useRef(0);
  // The radar shows from the sm breakpoint
  const wideEnough = useMediaQuery('(min-width: 640px)');
  const radarShownRef = useLiveRef(wideEnough);
  const lockRef = useRef(null);
  const input = useRef(new Set());
  // Set by mouse or drag look, so the next frame turns even with no key held
  const looked = useRef(false);
  // Door state: React state to draw the door meshes, mirrored in a ref for the movement loop
  const doorCells = world.doors;
  const [closedDoors, setClosedDoors] = useState(initialState?.doors ?? allClosed(doorCells));
  const doors = useRef(closedDoors);
  const heading = useRef('north');
  const invalidateRef = useRef(() => {});
  const cameraRef = useRef(null);
  const helpId = useId();
  // Game Mode: what is in the crosshair (a panel or a threat id), the panel open, the panels read,
  // the threats (a ref: they move every frame), the room, the weapon and sound (off by default)
  const [target, setTarget] = useState(null);
  const targetRef = useRef(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [read, setRead] = useState(initialState?.read ?? []);
  // Game Mode's mission: the sections read (kept in `read`, with the terminals), done once all
  // six are; its MISSION COMPLETE dialog, and the play time (carried across a demo's hand-off)
  const discovered = useMemo(
    () => (game ? SECTIONS.filter((id) => read.includes(id)) : []),
    [game, read]
  );
  const [missionDone, setMissionDone] = useState(initialState?.missionDone ?? false);
  const missionDoneRef = useRef(missionDone);
  // MISSION COMPLETE, open: how it ended ('sections', all six read, or 'threats', every one
  // neutralized), the play time and the shots, as they were then; null when closed
  const [complete, setComplete] = useState(null);
  // The last threat is down and MISSION COMPLETE opens in a moment: no pausing in between
  const missionPending = useRef(false);
  const missionClock = useRef({ total: initialState?.elapsed ?? 0, since: null });
  // A section opened for the first time: announced as discovered when its dossier closes
  const foundRef = useRef(null);
  // The lit path toward the next section (Facility draws it, the radar marks its end): the cells,
  // bumped `version` on each change, and the objective's cell
  const guideRef = useRef({ cells: [], version: 0, target: null });
  const guideFrom = useRef('');
  const [startEnemies] = useState(() =>
    ENEMIES.map((enemy) => {
      const saved = initialState?.enemies.find(({ id }) => id === enemy.id);
      const [cx, cz] = enemy.cell;
      return { ...enemy, x: cx + 0.5, z: cz + 0.5, alive: true, node: null, ...saved };
    })
  );
  // Moved by the frame loop, so kept in a ref
  const enemies = useRef(startEnemies);
  const [kills, setKills] = useState(() => startEnemies.filter((e) => !e.alive).length);
  // The crew: fixed (rooms.js); `paused` holds the threats while a dialog, the menu or a talk is up
  const npcs = useRef(NPCS.map((npc) => ({ ...npc, x: npc.cell[0] + 0.5, z: npc.cell[1] + 0.5 })));
  const paused = useRef(false);
  const [talk, setTalk] = useState(null);
  // The closed door near the player, with where it leads: { cell, text }
  const [doorLabel, setDoorLabel] = useState(null);
  const nearDoor = useRef('');
  const nearDoorCell = useRef(-1);
  const doorSaid = useRef({ key: '', at: -Infinity });
  // The trigger: held (automatic weapons keep firing) and when the gun that last fired is ready
  const firing = useRef({ held: false, ready: WEAPON_FX.map(() => -Infinity) });
  const fireRef = useRef(() => {});
  // Integrity at zero (the frame loop calls it): the latest `fail`, set after each render
  const failRef = useRef(() => {});
  const pointerType = useRef('mouse');
  const [room, setRoom] = useState(null);
  const roomRef = useRef(null);
  const [weapon, setWeapon] = useState(initialState?.weapon ?? 0);
  // Mirrors of `read` and `weapon` for snapshots, which can be taken from a timer
  const readRef = useRef(read);
  const weaponState = useRef(weapon);
  const [toast, setToast] = useState(null);
  // Facts waiting their turn: a blast that neutralizes several shows each, one after the other
  const factQueue = useRef([]);
  // The threat in the crosshair is past the weapon in hand's range
  const [far, setFar] = useState(false);
  const farRef = useRef(false);
  const [access, setAccess] = useState(false);
  const [sound, setSound] = useState(initialState?.sound ?? false);
  const soundRef = useRef(sound);
  const sfx = useRef(null);
  const fxRef = useRef(null);
  // Set by a shot, eased back to 0 by GameMotion (which adds the gauntlet's bob and sway)
  const motion = useRef(restMotion());
  // The command hub's hologram burns bright while its dossier is open (Facility reads it), and a
  // counter replays the HUD's edge glow each time it opens
  const hubLit = useRef(false);
  // How far the nearest wall, door or prop ahead is (cells), for the flashlight to dim up close
  const nearAhead = useRef(Infinity);
  const [hubFlash, setHubFlash] = useState(0);
  // The HUD's crosshair (its spread), energy and integrity bars and hit flash, written per frame
  const crosshairRef = useRef(null);
  const energyBar = useRef(null);
  const integrityBar = useRef(null);
  // The status bar's slim integrity meter, where the weapon card is hidden (a phone, a touch screen)
  const integritySlimBar = useRef(null);
  const hitRef = useRef(null);
  // Energy: each shot costs some (WEAPON_FX), refilled shortly after the last one. Integrity:
  // worn down while threats are close (`pressure`, counted by the threats), restored after
  // Both come back from a snapshot (a demo or the text-only mode is not a free heal)
  const energy = useRef({ value: initialState?.energy ?? 100, at: 0, warned: false });
  const integrity = useRef({
    value: initialState?.integrity ?? 100,
    at: 0,
    pulse: 0,
    warned: false,
    since: null,
  });
  const pressure = useRef(0);
  // The chromatic aberration's pulse (Facility eases it back)
  const postFx = useRef({ aberration: 0 });
  // Shots fired and shots that hit (a blast hitting several threats is one), for the accuracy
  const shots = useRef(initialState?.shots ?? { fired: 0, hit: 0 });
  // A kill's freeze frame: until when (freeze.js); the crosshair's hit marker
  const hitStop = useRef(0);
  const hitMarkerRef = useRef(null);
  const lastFlash = useRef(-Infinity);
  // A Memory Leak's drag on the player's speed (1: none), written by the threats each frame
  const slow = useRef(1);
  const [slowed, setSlowed] = useState(false);
  const slowedRef = useRef(false);
  // Escape during play pauses (the pause menu); integrity at zero is a SYSTEM FAILURE, and Reboot
  // respawns the player (Scene's respawnRef)
  const [pauseOpen, setPauseOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const failedRef = useRef(false);
  const respawnRef = useRef(null);
  // Set while the game itself frees the mouse (a dialog, a talk), so that unlock is not a pause
  const freeing = useRef(false);
  // Whether the mouse was captured when the pause menu opened: Resume captures it again
  const wasLocked = useRef(false);
  // High contrast mode (bright flat colors, no fog or post-processing) and the master volume:
  // per-viewer settings, remembered when the browser lets us
  const prefersContrast = useMediaQuery('(prefers-contrast: more)');
  const [contrast, setContrast] = useState(() => {
    const saved = readSetting(CONTRAST_KEY);
    return saved === null ? null : saved === '1';
  });
  const flat = contrast ?? prefersContrast;
  const [volume, setVolume] = useState(() => {
    const saved = readSetting(VOLUME_KEY);
    const value = Number(saved);
    return saved !== null && value >= 0 && value <= 1 ? value : 0.7;
  });
  const volumeRef = useRef(volume);
  // The graphics tier and Reduce flashing (which follows reduced motion until it is set)
  const [graphics, setGraphics] = useState(() => {
    const saved = readSetting(GRAPHICS_KEY);
    return TIERS.includes(saved) ? saved : 'medium';
  });
  const [flashSetting, setFlashSetting] = useState(() => {
    const saved = readSetting(FLASH_KEY);
    return saved === null ? null : saved === '1';
  });
  const noFlash = flashSetting ?? reduced;
  const noFlashRef = useLiveRef(noFlash);
  const [initialTuning] = useState(readTuning);
  const tuning = useRef(initialTuning);
  // The monitor's factor: a remounted monitor (after a pause) starts from the last one
  const [factor, setFactor] = useState(initialTuning.factor);
  const quality = quarter(factor);
  const [settled, setSettled] = useState(() => initialTuning.swings >= SWINGS);
  const retune = useCallback((dir, next) => {
    const tune = tuning.current;
    // A step at the top (or the bottom) changes nothing and is no swing
    if (next === tune.factor) return;
    if (tune.dir && dir !== tune.dir) tune.swings += 1;
    tune.dir = dir;
    tune.factor = next;
    saveTuning(tune);
    setFactor(next);
    if (tune.swings >= SWINGS) setSettled(true);
  }, []);
  const onIncline = useCallback(({ factor }) => retune(1, factor), [retune]);
  const onDecline = useCallback(({ factor }) => retune(-1, factor), [retune]);
  const stride = useRef(null);
  const allReadAnnounced = useRef(false);
  const timers = useRef({});
  const panelList = game ? GAME_PANELS : PANELS;

  // Walls, closed doors and anything outside the enclosed area block the way
  const solid = useCallback(
    (cx, cz) => !isFloor(cx, cz) || doors.current[cz * W + cx] === true,
    [W, isFloor]
  );

  const panels = useMemo(
    () =>
      panelList.map((panel) => {
        const lines = {
          welcome: [t('demos.cub3d.panels.welcomeBody')],
          // Game Mode's spawn room carries the whole summary
          about: [t(game ? 'person.summary' : 'person.title')],
          skills: [technologies.join(' · ')],
          projects: [projects.join(' · ')],
          cub3d: [t('demos.game.panels.cub3dBody')],
          fdf: [t('demos.game.panels.fdfBody')],
          contact: [t('demos.game.panels.contactBody')],
        }[panel.id];
        // The facility's mounted screens: which section (or a live demo), the title, and a tick
        const kicker =
          panel.kind === 'section'
            ? t('demos.game.dossier', {
                number: SECTIONS.indexOf(panel.id) + 1,
                total: SECTIONS.length,
              })
            : t('demos.game.liveDemo');
        return {
          ...panel,
          title: panelTitle(t, panel.id, game),
          lines,
          kicker: game ? kicker : null,
          done: t('demos.game.mission.discovered'),
        };
      }),
    [t, technologies, projects, panelList, game]
  );
  // The sprites' labels: threat types and the crew's names
  const threatLabels = useMemo(
    () => ({
      ...Object.fromEntries(
        Object.keys(THREAT_TYPES).map((type) => [type, t(`demos.game.enemies.${type}`)])
      ),
      ...Object.fromEntries(NPCS.map(({ id }) => [id, t(`demos.game.npcs.${id}.name`)])),
    }),
    [t]
  );

  // Read once: the page (and its theme toggle) is inert while the demo is open
  const colors = useMemo(() => {
    // Game Mode's radar from its dark island; the cub3D demo's minimap from the page
    const c = (game ? readGameTheme : readTheme)([
      'foreground',
      'foreground-muted',
      'background',
      'primary',
      'primary-400',
      'danger',
      'success',
      'info',
      'secondary',
    ]);
    return {
      back: rgb(c.background, 0.85),
      wall: rgb(c.foreground, 0.75),
      closed: rgb(c.danger),
      open: rgb(c.success),
      ray: rgb(c.primary, 0.55),
      player: rgb(c.primary),
      // The tactical radar: gray walls, you in white with your view cone, threats red, the crew
      // amber, doors blue
      radarWall: rgb(c['foreground-muted'], 0.85),
      you: rgb(c.foreground),
      cone: rgb(c.foreground, 0.22),
      threat: rgb(c.danger),
      leak: rgb(c.secondary),
      crew: rgb(c['primary-400']),
      door: rgb(c.info),
      sweep: rgb(c.success),
      objective: rgb(c.success),
    };
  }, [game]);

  // The minimap's walls and doors, painted once (and again when a door changes)
  const paintStatic = useCallback(() => {
    const s = MINIMAP_CELL;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const layer = staticLayer.current ?? document.createElement('canvas');
    staticLayer.current = layer;
    layer.width = W * s * dpr;
    layer.height = H * s * dpr;
    const ctx = layer.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colors.back;
    ctx.fillRect(0, 0, W * s, H * s);
    ctx.fillStyle = colors.wall;
    for (let i = 0; i < W * H; i += 1) {
      if (!WALKABLE[i]) ctx.fillRect((i % W) * s, Math.floor(i / W) * s, s, s);
    }
    // Red and filled when closed, a green outline when open (the original's colors, plus a
    // shape so the state does not rest on color alone)
    doorCells.forEach((i) => {
      const x = (i % W) * s;
      const z = Math.floor(i / W) * s;
      if (doors.current[i]) {
        ctx.fillStyle = colors.closed;
        ctx.fillRect(x, z, s, s);
      } else {
        ctx.strokeStyle = colors.open;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.75, z + 0.75, s - 1.5, s - 1.5);
      }
    });
  }, [colors, doorCells, W, H, WALKABLE]);

  // Game Mode's tactical radar, every frame: the whole map (its walls painted once), the doors,
  // every threat and the crew through the walls, and the player with a view cone. The player's
  // halo blinks, unless motion is reduced
  const drawRadar = useCallback(
    (camera, time) => {
      const canvas = radarRef.current;
      if (!canvas) return;
      const s = RADAR_CELL;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Painted again when the pixel ratio (browser zoom, another monitor) or the theme changes
      if (radarLayer.current?.dpr !== dpr || radarLayer.current.colors !== colors) {
        const layer = document.createElement('canvas');
        layer.width = W * s * dpr;
        layer.height = H * s * dpr;
        const ctx = layer.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = colors.back;
        ctx.fillRect(0, 0, W * s, H * s);
        ctx.fillStyle = colors.radarWall;
        for (let i = 0; i < W * H; i += 1) {
          if (!WALKABLE[i]) ctx.fillRect((i % W) * s, Math.floor(i / W) * s, s, s);
        }
        radarLayer.current = { layer, dpr, colors };
        canvas.width = layer.width;
        canvas.height = layer.height;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // The layer is translucent: cleared first, or each frame would pile up on the last
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(radarLayer.current.layer, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Doors: filled while closed, an outline once open
      ctx.fillStyle = colors.door;
      ctx.strokeStyle = colors.door;
      ctx.lineWidth = 1.5;
      doorCells.forEach((i) => {
        const x = (i % W) * s;
        const z = Math.floor(i / W) * s;
        if (doors.current[i]) ctx.fillRect(x + 1, z + 1, s - 2, s - 2);
        else ctx.strokeRect(x + 1.5, z + 1.5, s - 3, s - 3);
      });
      const dot = (x, z, r, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x * s, z * s, r, 0, Math.PI * 2);
        ctx.fill();
      };
      // Told apart by shape as well as color: threats are crosses, a memory leak a triangle, the crew
      // diamonds. A Zero-Day shows only once the flashlight has found it
      ctx.strokeStyle = colors.threat;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'square';
      ctx.beginPath();
      enemies.current.forEach((e) => {
        const kind = THREAT_TYPES[e.type];
        if (!e.alive || kind.slows || (kind.stealth && !e.seen)) return;
        ctx.moveTo(e.x * s - 3, e.z * s - 3);
        ctx.lineTo(e.x * s + 3, e.z * s + 3);
        ctx.moveTo(e.x * s + 3, e.z * s - 3);
        ctx.lineTo(e.x * s - 3, e.z * s + 3);
      });
      ctx.stroke();
      ctx.strokeStyle = colors.leak;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      enemies.current.forEach((e) => {
        if (!e.alive || !THREAT_TYPES[e.type].slows) return;
        ctx.beginPath();
        ctx.moveTo(e.x * s, e.z * s - 4);
        ctx.lineTo(e.x * s + 4, e.z * s + 3.5);
        ctx.lineTo(e.x * s - 4, e.z * s + 3.5);
        ctx.closePath();
        ctx.stroke();
      });
      ctx.fillStyle = colors.crew;
      ctx.beginPath();
      npcs.current.forEach((n) => {
        ctx.moveTo(n.x * s, n.z * s - 4.5);
        ctx.lineTo(n.x * s + 4.5, n.z * s);
        ctx.lineTo(n.x * s, n.z * s + 4.5);
        ctx.lineTo(n.x * s - 4.5, n.z * s);
        ctx.closePath();
      });
      ctx.fill();
      // The next section's terminal: a ring
      const goal = guideRef.current.target;
      if (goal) {
        ctx.strokeStyle = colors.objective;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc((goal[0] + 0.5) * s, (goal[1] + 0.5) * s, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      const { x, z } = camera.position;
      const yaw = camera.rotation.y;
      const half = (FOV * Math.PI) / 360;
      if (!reduced) {
        // A sweep line turning around the player, its afterglow fading behind it
        const reach = Math.hypot(W, H) * s;
        ctx.strokeStyle = colors.sweep;
        ctx.lineWidth = 2;
        for (let k = 0; k < 8; k += 1) {
          const a = time * 2.4 - k * 0.07;
          ctx.globalAlpha = 0.45 * (1 - k / 8);
          ctx.beginPath();
          ctx.moveTo(x * s, z * s);
          ctx.lineTo(x * s + Math.cos(a) * reach, z * s + Math.sin(a) * reach);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = colors.cone;
      ctx.beginPath();
      ctx.moveTo(x * s, z * s);
      [yaw + half, yaw - half].forEach((a) =>
        ctx.lineTo((x - Math.sin(a) * RADAR_CONE) * s, (z - Math.cos(a) * RADAR_CONE) * s)
      );
      ctx.closePath();
      ctx.fill();
      dot(x, z, 3.5, colors.you);
      if (!reduced) {
        ctx.strokeStyle = colors.you;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 6);
        ctx.beginPath();
        ctx.arc(x * s, z * s, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
    [colors, doorCells, reduced, W, H, WALKABLE]
  );

  // Per move: the static layer, then the field of view's rays and the player
  const drawMinimap = useCallback(
    (camera) => {
      const canvas = minimapRef.current;
      if (!canvas || !camera) return;
      if (!staticLayer.current) paintStatic();
      const layer = staticLayer.current;
      // Sized once (resizing a canvas reallocates it)
      if (canvas.width !== layer.width) {
        canvas.width = layer.width;
        canvas.height = layer.height;
      }
      const s = MINIMAP_CELL;
      const dpr = layer.width / (W * s);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(layer, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { x, z } = camera.position;
      const yaw = camera.rotation.y;
      const half = (FOV * Math.PI) / 360;
      ctx.strokeStyle = colors.ray;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < MINIMAP_RAYS; i += 1) {
        const [hx, hz] = castRay(x, z, yaw + half - (2 * half * i) / (MINIMAP_RAYS - 1), solid);
        ctx.moveTo(x * s, z * s);
        ctx.lineTo(hx * s, hz * s);
      }
      ctx.stroke();
      ctx.fillStyle = colors.player;
      ctx.beginPath();
      ctx.arc(x * s, z * s, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
    },
    [colors, paintStatic, solid, W]
  );

  const facingTimer = useRef(0);
  // Re-announces a message even when it is the same as the last one. Anything announced drops a
  // heading still waiting to be said, so it cannot talk over this
  const announce = useCallback((text) => {
    window.clearTimeout(facingTimer.current);
    setMessage('');
    requestAnimationFrame(() => setMessage(text));
  }, []);
  const aimTimer = useRef(0);
  const [aimSaid, setAimSaid] = useState('');
  useEffect(() => {
    const all = timers.current;
    return () => {
      window.clearTimeout(facingTimer.current);
      window.clearTimeout(aimTimer.current);
      Object.values(all).forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Game Mode, every frame: the radar, an automatic weapon's next shot, the closed door near
  // the player (shown and announced with where it leads), and the aim (threats move, so it can
  // change while the player stands still). A new target is announced once the aim settles, not
  // for everything swept past
  const clock = useRef(0);
  const onTick = useCallback(
    (camera, dt) => {
      clock.current += dt;
      // About 30 times a second (every frame it is asked for under reduced motion), and not at
      // all while it is hidden on a small window
      radarDue.current -= dt;
      if (radarShownRef.current && (reduced || radarDue.current <= 0)) {
        radarDue.current = 1 / 30;
        drawRadar(camera, clock.current);
      }
      if (!startedRef.current) return;
      if (firing.current.held) {
        fireRef.current(false);
        // The frame loop is on demand under reduced motion: keep it running for the next shot
        if (WEAPON_FX[weaponState.current].auto) invalidateRef.current();
      }
      // Energy refills shortly after the last shot
      const now = timeNow();
      const en = energy.current;
      if (now - en.at > REFILL_AFTER_MS && en.value < 100) {
        en.value = Math.min(100, en.value + 40 * dt);
        invalidateRef.current();
      }
      if (en.warned && en.value >= 100) en.warned = false;
      // Threats close by wear integrity down, in pulses (a hit flash and aberration, a sound)
      const hp = integrity.current;
      const hurt = pressure.current;
      // A wind-up once a threat comes into reach: brushing past one costs nothing
      if (hurt && hp.since === null) hp.since = now;
      if (!hurt) hp.since = null;
      if (hurt && now - hp.since >= HARM_WINDUP_MS) {
        hp.value = Math.max(0, hp.value - HARM_RATE * hurt * dt);
        hp.at = now;
        hp.pulse -= dt;
        if (hp.pulse <= 0) {
          hp.pulse = 0.5;
          postFx.current.aberration = 1;
          motion.current.shake = Math.max(motion.current.shake, 0.4);
          if (soundRef.current) sfx.current?.hit();
          // A red flash at the edges; with reduced motion or Reduce flashing, a steady red edge
          // while it lasts instead
          if (reduced || noFlashRef.current) {
            if (hitRef.current) hitRef.current.style.opacity = '0.5';
          } else hitRef.current?.animate?.([{ opacity: 0.85 }, { opacity: 0 }], 420);
        }
        if (hp.value < 30 && !hp.warned) {
          hp.warned = true;
          announce(t('demos.game.integrityLow'));
        }
        // Integrity gone: SYSTEM FAILURE
        if (hp.value <= 0 && !failedRef.current) failRef.current();
      } else if (!hurt) {
        hp.pulse = 0;
        // The steady edge (Reduce flashing) holds a moment, so a threat at the edge of its reach
        // does not make it flicker
        if (now - hp.at > 500 && hitRef.current?.style.opacity) hitRef.current.style.opacity = '';
        if (now - hp.at > 1500 && hp.value < 100) {
          hp.value = Math.min(100, hp.value + 8 * dt);
          invalidateRef.current();
        }
        if (hp.value > 60) hp.warned = false;
      }
      writeBar(energyBar.current, en.value);
      writeBar(integrityBar.current, hp.value);
      writeBar(integritySlimBar.current, hp.value);
      // A Memory Leak's drag: shown (and said once) as it starts, with a margin so its edge does
      // not flicker
      const dragged = slowedRef.current ? slow.current < 0.99 : slow.current < 0.95;
      if (dragged !== slowedRef.current) {
        slowedRef.current = dragged;
        setSlowed(dragged);
        if (dragged) announce(t('demos.game.slowedSay'));
      }
      const { x, z } = camera.position;
      let door = null;
      let nearest = DOOR_LABEL_RANGE;
      doorCells.forEach((cell) => {
        const cx = cell % W;
        const cz = Math.floor(cell / W);
        const d = Math.hypot(cx + 0.5 - x, cz + 0.5 - z);
        // The door already offered keeps its label a little further, so the edge does not flicker
        const range = cell === nearDoorCell.current ? nearest + 0.5 : nearest;
        if (!doors.current[cell] || DOOR_ROOMS.get(cell).length < 2 || d >= range) return;
        // In sight: not one behind a wall
        const blocked = (bx, bz) => (bx !== cx || bz !== cz) && solid(bx, bz);
        if (!clearLine(x, z, cx + 0.5, cz + 0.5, blocked)) return;
        door = cell;
        nearest = d;
      });
      const here = roomAt(x, z);
      const place = door === null ? null : DOOR_ROOMS.get(door).find((room) => room !== here);
      const key = door === null ? '' : `${door}:${place}`;
      nearDoorCell.current = door ?? -1;
      if (key !== nearDoor.current) {
        nearDoor.current = key;
        const name = place && t(`demos.game.doorTo.${place}`);
        setDoorLabel(
          door === null
            ? null
            : {
                cell: door,
                x: door % W,
                z: Math.floor(door / W),
                text: t('demos.game.doorLabel', { place: name }),
              }
        );
        // Once per door, again only after a while
        const now = timeNow();
        if (door !== null && (key !== doorSaid.current.key || now - doorSaid.current.at > 15000)) {
          doorSaid.current = { key, at: now };
          announce(t('demos.game.doorNear', { place: name }));
        }
      }
      // The nearest surface straight ahead: a wall or closed door (the DDA), or a prop's box
      {
        const { x, z } = camera.position;
        const yaw = camera.rotation.y;
        const [hx, hz] = castRay(x, z, yaw, solid);
        nearAhead.current = Math.min(Math.hypot(hx - x, hz - z), propAhead(x, z, yaw));
      }
      const aimed = aimAt(
        camera,
        solid,
        GAME_PANELS,
        enemies.current,
        npcs.current,
        PANEL_RANGE,
        AIM_REACH,
        HUB_OBJECTS
      );
      // A threat past the weapon in hand's range: the HUD dims its label and says so
      const enemy = aimed && enemies.current.find((e) => e.id === aimed);
      const outOfRange =
        !!enemy &&
        Math.hypot(enemy.x - camera.position.x, enemy.z - camera.position.z) >
          WEAPON_FX[weaponState.current].range;
      if (outOfRange !== farRef.current) {
        farRef.current = outOfRange;
        setFar(outOfRange);
      }
      if (aimed === targetRef.current) return;
      targetRef.current = aimed;
      setTarget(aimed);
      window.clearTimeout(aimTimer.current);
      if (!aimed) {
        setAimSaid('');
        return;
      }
      const named = aimText(t, enemies.current, aimed);
      const text = outOfRange ? `${named}. ${t('demos.game.outOfRange')}` : named;
      aimTimer.current = window.setTimeout(() => setAimSaid(text), 300);
    },
    [announce, solid, t, drawRadar, doorCells, reduced, W, noFlashRef, radarShownRef, startedRef]
  );

  // The lit path from the player's cell to the next section's terminal, again whenever the player
  // reaches another cell or a section is found (`force`)
  const updateGuide = useCallback(
    (camera, force = false) => {
      if (!game || !camera) return;
      const next = SECTIONS.find((id) => !readRef.current.includes(id));
      const cx = Math.floor(camera.position.x);
      const cz = Math.floor(camera.position.z);
      const key = `${cx},${cz},${next}`;
      if (!force && key === guideFrom.current) return;
      guideFrom.current = key;
      const guide = guideRef.current;
      guide.version += 1;
      guide.section = next ?? null;
      if (!next) {
        guide.cells = [];
        guide.target = null;
        return;
      }
      guide.target = panelCell(SECTION_PANELS[next]);
      const path = findPath(world, [cx, cz], guide.target, PROP_CELLS) ?? [];
      // From the cell after the player's, each with the one before it (the way it points)
      guide.cells = path
        .slice(1, GUIDE_LENGTH + 1)
        .map((cell, i) => [cell % world.W, Math.floor(cell / world.W), path[i]]);
    },
    [game, world]
  );

  // Called after every move: redraw the minimap; a new heading is announced once turning has
  // settled, not at every 45° crossed on the way
  const onMove = useCallback(
    (camera) => {
      cameraRef.current = camera;
      // Game Mode's radar is drawn every frame instead (onTick)
      if (!game) drawMinimap(camera);
      if (game) {
        const { x, z } = camera.position;
        const here = roomAt(x, z);
        if (here && here !== roomRef.current) {
          roomRef.current = here;
          setRoom(here);
          announce(t('demos.game.roomEntered', { name: t(`demos.game.rooms.${here}`) }));
        }
        updateGuide(camera);
        // A footstep every STRIDE cells walked
        if (!stride.current) stride.current = { x, z, left: STRIDE };
        const last = stride.current;
        last.left -= Math.hypot(x - last.x, z - last.z);
        last.x = x;
        last.z = z;
        if (last.left <= 0) {
          last.left = STRIDE;
          if (soundRef.current) sfx.current?.step();
        }
      }
      const next = headingOf(camera.rotation.y);
      if (next === heading.current) return;
      heading.current = next;
      window.clearTimeout(facingTimer.current);
      facingTimer.current = window.setTimeout(() => {
        announce(t('demos.cub3d.sr.facing', { direction: t(`demos.cub3d.directions.${next}`) }));
      }, 500);
    },
    [drawMinimap, announce, t, game, updateGuide]
  );

  const play = (name) => {
    if (soundRef.current) sfx.current?.[name]();
  };
  const later = (name, fn, ms) => {
    window.clearTimeout(timers.current[name]);
    timers.current[name] = window.setTimeout(fn, ms);
  };

  // The door cell just ahead (within DOOR_REACH), or -1
  const doorAhead = () => {
    const camera = cameraRef.current;
    if (!camera) return -1;
    const yaw = camera.rotation.y;
    const here = Math.floor(camera.position.z) * W + Math.floor(camera.position.x);
    for (const reach of DOOR_REACH) {
      const ax = Math.floor(camera.position.x - Math.sin(yaw) * reach);
      const az = Math.floor(camera.position.z - Math.cos(yaw) * reach);
      const ahead = az * W + ax;
      if (ahead in doors.current && ahead !== here) return ahead;
    }
    return -1;
  };

  // Space opens or closes the door ahead, as in the original. In Game Mode the closed door whose
  // label is showing counts as ahead
  const toggleDoor = () => {
    const camera = cameraRef.current;
    const ahead = game && nearDoorCell.current >= 0 ? nearDoorCell.current : doorAhead();
    if (ahead < 0) {
      announce(t('demos.cub3d.sr.noDoor'));
      return;
    }
    const closed = !doors.current[ahead];
    const cells = world.doorOf[ahead] ?? [ahead];
    // Never closed onto someone: the player's box or a live threat in either of its cells
    if (closed && cells.some((cell) => doorwayTaken(cell, world.W, camera, enemies.current))) {
      announce(t('demos.cub3d.sr.doorBlocked'));
      return;
    }
    const whole = Object.fromEntries(cells.map((cell) => [cell, closed]));
    doors.current = { ...doors.current, ...whole };
    setClosedDoors(doors.current);
    announce(t(closed ? 'demos.cub3d.sr.doorClosed' : 'demos.cub3d.sr.doorOpened'));
    play('hiss');
    if (!game) {
      paintStatic();
      drawMinimap(camera);
    }
    invalidateRef.current();
  };

  // Where the game is, for a terminal's demo or the text-only mode to hand back
  const snapshot = () => {
    const camera = cameraRef.current;
    return {
      x: camera?.position.x ?? world.player.x,
      z: camera?.position.z ?? world.player.z,
      yaw: camera?.rotation.y ?? world.player.yaw,
      doors: doors.current,
      read: readRef.current,
      missionDone: missionDoneRef.current,
      elapsed: clockElapsed(missionClock.current),
      integrity: integrity.current.value,
      energy: energy.current.value,
      weapon: weaponState.current,
      sound: soundRef.current,
      shots: shots.current,
      enemies: enemies.current.map(({ id, x, z, alive, seen }) => ({ id, x, z, alive, seen })),
    };
  };

  // The fact at the head of the queue, for TOAST_MS, then the next
  const showFact = () => {
    const [enemy] = factQueue.current;
    if (!enemy) {
      setToast(null);
      return;
    }
    setToast({
      key: enemy.id,
      title: t(`demos.game.facts.${enemy.fact}.title`),
      body: t(`demos.game.facts.${enemy.fact}.body`),
    });
    later(
      'toast',
      () => {
        factQueue.current = factQueue.current.slice(1);
        showFact();
      },
      TOAST_MS
    );
  };

  const neutralize = (enemy) => {
    enemy.alive = false;
    // Off the crosshair now, not at the next frame's aim
    if (targetRef.current === enemy.id) {
      targetRef.current = null;
      setTarget(null);
    }
    if (enemy.node) enemy.node.visible = false;
    // It bursts into voxels (no particles with reduced motion)
    fxRef.current?.shatter?.([enemy.x, 0.5, enemy.z], enemy.type);
    play('shatter');
    play('kill');
    // The impact: a 0.2 s freeze frame, and the hit marker (the crosshair turns red, four ticks
    // flare round it; only the color with reduced motion)
    hitStop.current = timeNow() + HIT_STOP_MS;
    const cross = crosshairRef.current;
    if (cross) cross.dataset.hit = 'true';
    later(
      'hit',
      () => {
        if (crosshairRef.current) crosshairRef.current.dataset.hit = 'false';
      },
      HIT_STOP_MS
    );
    hitMarkerRef.current?.animate?.(
      reduced
        ? [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: 'scale(0.6)' },
            { opacity: 1, transform: 'scale(1.2)', offset: 0.35 },
            { opacity: 0, transform: 'scale(1.35)' },
          ],
      // Under 150 ms: a punch, then gone (an overshoot to 1.2 at a third of the way)
      { duration: 140, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' }
    );
    // Reduced motion draws on demand: the hidden threat must be redrawn away
    invalidateRef.current();
    setKills((n) => n + 1);
    // Its own fact shows in the HUD's own live region, which announces it; one already showing
    // keeps its time, and this one follows
    factQueue.current = [...factQueue.current, enemy];
    if (factQueue.current.length === 1) showFact();
    // The last threat: the mission is complete too (once), after a moment to see the kill
    if (!missionDoneRef.current && enemies.current.every((e) => !e.alive)) {
      missionDoneRef.current = true;
      setMissionDone(true);
      const time = clockElapsed(missionClock.current);
      missionPending.current = true;
      later(
        'complete',
        () => {
          missionPending.current = false;
          setPauseOpen(false);
          holdView();
          setComplete({ by: 'threats', time, shots: { ...shots.current } });
        },
        700
      );
    }
  };

  // Before a dialog or a talk: the mouse is freed, keys let go, and no recoil or shake is left
  // frozen mid-way while the view pauses
  const holdView = () => {
    // The unlock that follows is the game's own, not the player's Escape (cleared by the next
    // lock, so it never outlives a release that did not happen)
    freeing.current = true;
    lockRef.current?.unlock();
    input.current.clear();
    firing.current.held = false;
    // Every field back to rest, keeping only the shell count (the viewmodel's pool follows it)
    motion.current = { ...restMotion(), eject: motion.current.eject };
    const camera = cameraRef.current;
    if (camera) {
      camera.rotation.x = 0;
      camera.rotation.z = 0;
    }
    invalidateRef.current();
  };

  // A crew member talks: the threats hold still until the dialogue closes
  const talkTo = (id) => {
    holdView();
    paused.current = true;
    setTalk(id);
    play('talk');
  };
  const closeTalk = () => {
    setTalk(null);
    paused.current = false;
    requestAnimationFrame(() => wrapperRef.current?.focus({ preventScroll: true }));
  };

  // A wall's panel read: a section is ticked off (and announced as it closes), a terminal hands
  // over to its demo, anything else opens its text
  const readPanel = (id) => {
    holdView();
    foundRef.current = KIND[id] === 'section' && !readRef.current.includes(id) ? id : null;
    if (!readRef.current.includes(id)) readRef.current = [...readRef.current, id];
    setRead(readRef.current);
    play('blip');
    if (KIND[id] === 'terminal') openTerminal(id);
    else setOpenPanel(id);
  };

  // Game Mode. E, Enter or the touch Use button acts on what is in the crosshair: a crew member
  // talks, a panel opens (its text, the contact form, or after "Access granted" a terminal's live
  // demo). Nothing in the crosshair works the door ahead
  const interact = () => {
    // The last threat just fell: MISSION COMPLETE is on its way, nothing may open over it
    if (missionPending.current) return;
    const id = targetRef.current;
    if (!id) {
      toggleDoor();
      return;
    }
    // Threats are shot, not used: E opens the door that is offered, or says how to shoot
    if (enemies.current.some((e) => e.id === id)) {
      if (nearDoorCell.current >= 0) toggleDoor();
      else announce(aimText(t, enemies.current, id));
      return;
    }
    if (NPC_IDS.has(id)) {
      const npc = npcs.current.find((n) => n.id === id);
      const camera = cameraRef.current;
      const d =
        npc && camera ? Math.hypot(npc.x - camera.position.x, npc.z - camera.position.z) : 0;
      if (d > TALK_RANGE) {
        announce(t('demos.game.closerToTalk', { name: t(`demos.game.npcs.${id}.name`) }));
        return;
      }
      talkTo(id);
      return;
    }
    // The command hub: its own dossier (briefing, progress, controls), with a sound, the
    // hologram lighting up and an edge glow. Not a section: the mission does not count it
    if (KIND[id] === 'hub') {
      // Lit before holdView's frame, so that frame shows it
      hubLit.current = true;
      holdView();
      play('access');
      setHubFlash((n) => n + 1);
      setOpenPanel(id);
      return;
    }
    readPanel(id);
  };
  // "Access granted", then a terminal's live demo (from its wall, or the Projects dossier)
  const openTerminal = (id, before = '') => {
    if (!readRef.current.includes(id)) {
      readRef.current = [...readRef.current, id];
      setRead(readRef.current);
    }
    setAccess(true);
    // After a discovery said in the same moment: one message, so neither cuts the other off
    announce(before ? `${before} ${t('demos.game.accessGranted')}` : t('demos.game.accessGranted'));
    later('access', () => onOpenDemo(id, snapshot()), reduced ? 400 : 700);
  };
  // From the Projects dossier. If closing it completed the mission, MISSION COMPLETE comes first:
  // the demo stays a button away (in the Projects room)
  const runDemo = (id) => {
    const { completed, said } = closePanel();
    if (!completed) openTerminal(id, said);
  };

  // Fires the weapon in hand (WEAPON_FX): `press` is a click or F, otherwise an automatic
  // weapon's next shot while the trigger is held. A press on a panel or a crew member uses it
  // instead. Each weapon has its own shake, recoil, sound and particles: the rifle a trail to the
  // target, the pistol blocks where it lands, the blaster a burst on everything in its cone
  const fire = (press) => {
    const cfg = WEAPON_FX[weaponState.current];
    const now = timeNow();
    const camera = cameraRef.current;
    if (!camera || (!press && !cfg.auto)) return;
    // A press on a terminal uses it, whatever the weapon's cooldown. A crew member in the sights:
    // hold fire (E talks)
    const id = targetRef.current;
    if (press && id && KIND[id]) {
      interact();
      return;
    }
    if (id && NPC_IDS.has(id)) return;
    if (now < firing.current.ready[weaponState.current]) return;
    // Out of energy: a dry click on a press, and it says so once until it has recharged (an
    // automatic weapon running dry while held too)
    if (energy.current.value < cfg.energy) {
      if (press) play('empty');
      if (!energy.current.warned) {
        energy.current.warned = true;
        announce(t('demos.game.recharging'));
      }
      return;
    }
    energy.current.value -= cfg.energy;
    energy.current.at = now;
    shots.current.fired += 1;
    firing.current.ready[weaponState.current] = now + cfg.cooldown * 1000;
    // The recoil's target: a shot adds to it (rapid fire climbs, to a point), the weapon springs
    // up to it fast and settles back slowly (GameMotion)
    motion.current.kick = Math.min(1.3, motion.current.kick + cfg.kick);
    motion.current.shake = cfg.shake;
    // The rifle's bolt and the pistol's slide throw a shell (the blaster has none)
    if (cfg.shell) motion.current.eject += 1;
    // The muzzle flash, no more than three times a second whatever the rate of fire
    if (now - lastFlash.current >= 334) {
      motion.current.flash = 1;
      lastFlash.current = now;
    }
    postFx.current.aberration = Math.max(postFx.current.aberration, cfg.shake * 0.7);
    play(cfg.sound);
    const { x, z } = camera.position;
    const yaw = camera.rotation.y;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    // Far enough ahead that the first particles are not drawn huge right at the eye
    const muzzle = [x + fx * 0.9, 0.42, z + fz * 0.9];
    const hits = cfg.cone
      ? inCone(camera, enemies.current, solid, cfg)
      : enemies.current.filter(
          (e) => e.alive && e.id === id && Math.hypot(e.x - x, e.z - z) <= cfg.range
        );
    if (hits.length) shots.current.hit += 1;
    let impacts = hits.map((e) => [e.x, 0.5, e.z]);
    if (!impacts.length) {
      const [hx, hz] = castRay(x, z, yaw, solid);
      const d = Math.min(Math.hypot(hx - x, hz - z), cfg.cone ? 2.5 : cfg.range);
      impacts = [[x + fx * d, 0.5, z + fz * d]];
    }
    impacts.forEach((at) => fxRef.current?.spawn(cfg.fx, muzzle, at));
    hits.forEach(neutralize);
  };
  // The frame loop fires the automatic weapons: the latest `fire`, after each render
  useLayoutEffect(() => {
    fireRef.current = fire;
  });
  const pullTrigger = () => {
    firing.current.held = true;
    fire(true);
    // An automatic weapon's next shots come from the frame loop: start it (on demand otherwise)
    if (WEAPON_FX[weaponState.current].auto) invalidateRef.current();
  };
  const releaseTrigger = () => {
    firing.current.held = false;
  };
  const switchWeapon = (next) => {
    const w = (next + WEAPON_COUNT) % WEAPON_COUNT;
    weaponState.current = w;
    setWeapon(w);
    announce(t('demos.game.weapon', { name: t('demos.game.weapons')[w] }));
  };
  const wheelAt = useRef(0);
  const onWheel = (e) => {
    // Only over the view itself during play: a wheel over a dialog portaled out of it (the pause
    // menu, MISSION COMPLETE, SYSTEM FAILURE) bubbles here through React, and must not switch
    const held = openPanel || talk || complete || pauseOpen || failed || access;
    if (!game || !started || held || !e.currentTarget.contains(e.target)) return;
    if (timeNow() - wheelAt.current < 200) return;
    wheelAt.current = timeNow();
    switchWeapon(weapon + (e.deltaY > 0 ? 1 : -1));
  };
  const closePanel = () => {
    setOpenPanel(null);
    hubLit.current = false;
    if (game) {
      const found = foundRef.current;
      foundRef.current = null;
      let said = null;
      if (found) {
        const count = SECTIONS.filter((id) => readRef.current.includes(id)).length;
        said = t('demos.game.mission.found', {
          name: panelTitle(t, found, true),
          count,
          total: SECTIONS.length,
        });
        // Projects read: the vault's laser grid goes down (Facility fades it out)
        if (found === 'projects') {
          said = `${said} ${t('demos.game.vaultOpen')}`;
          play('lasers');
        }
        announce(said);
        // The sixth: the mission is complete (once; a later visit to a wall does not repeat it)
        if (count === SECTIONS.length && !missionDoneRef.current) {
          missionDoneRef.current = true;
          setMissionDone(true);
          setComplete({
            by: 'sections',
            time: clockElapsed(missionClock.current),
            shots: { ...shots.current },
          });
          return { completed: true, said };
        }
      }
      updateGuide(cameraRef.current, true);
      invalidateRef.current();
      requestAnimationFrame(() => wrapperRef.current?.focus({ preventScroll: true }));
      return { completed: false, said };
    }
    if (read.length === panelList.length && !allReadAnnounced.current) {
      allReadAnnounced.current = true;
      announce(t('demos.game.allRead'));
    } else {
      announce(t('demos.game.status.walls', { count: read.length, total: panelList.length }));
    }
    requestAnimationFrame(() => wrapperRef.current?.focus({ preventScroll: true }));
  };

  const closeComplete = () => {
    setComplete(null);
    updateGuide(cameraRef.current, true);
    invalidateRef.current();
    requestAnimationFrame(() => wrapperRef.current?.focus({ preventScroll: true }));
  };

  // The synthesizer loads on first use; sound stays off until the player turns it on
  const toggleSound = () => {
    soundRef.current = !soundRef.current;
    setSound(soundRef.current);
    // Muted: the audio thread stops too
    if (!soundRef.current) {
      sfx.current?.suspend();
      return;
    }
    loadSfx().then(({ createSfx }) => {
      // The player may have muted again, or left, while the chunk loaded
      if (!soundRef.current || !wrapperRef.current) return;
      if (!sfx.current) sfx.current = createSfx(volumeRef.current);
      sfx.current.resume();
      // The facility's low server hum, under everything
      if (game) sfx.current.hum(true);
      sfx.current.blip();
    });
  };
  const changeVolume = (value) => {
    volumeRef.current = value;
    setVolume(value);
    sfx.current?.setVolume(value);
    saveSetting(VOLUME_KEY, String(value));
  };
  const toggleContrast = () => {
    const next = !flat;
    setContrast(next);
    announce(t(next ? 'demos.game.contrastOn' : 'demos.game.contrastOff'));
    invalidateRef.current();
    saveSetting(CONTRAST_KEY, next ? '1' : '0');
  };
  const changeGraphics = (tier) => {
    // The radio itself says what is picked: nothing more to announce
    setGraphics(tier);
    invalidateRef.current();
    saveSetting(GRAPHICS_KEY, tier);
  };
  const toggleFlash = () => {
    const next = !noFlash;
    // Its pressed state says it
    setFlashSetting(next);
    invalidateRef.current();
    saveSetting(FLASH_KEY, next ? '1' : '0');
  };
  const settings = {
    graphics,
    onGraphics: changeGraphics,
    noFlash,
    onFlash: toggleFlash,
    contrast: flat,
    onContrast: toggleContrast,
    sound,
    onSound: toggleSound,
    volume,
    onVolume: changeVolume,
  };
  // Back to the view after a pointer click on a HUD control, so the keys move the player again
  const focusView = () => wrapperRef.current?.focus({ preventScroll: true });

  // Escape (or the mouse let go by the browser's Escape) during play: the pause menu
  const pause = () => {
    // Not over Access granted's hand-off to a demo, MISSION COMPLETE on its way, or SYSTEM FAILURE
    if (access || failed || missionPending.current) return;
    wasLocked.current = !!document.pointerLockElement || wasLocked.current;
    holdView();
    setPauseOpen(true);
  };
  const resume = () => {
    setPauseOpen(false);
    // Back to the crew member's line if it is still open (it is modal), else to the view
    requestAnimationFrame(() =>
      (wrapperRef.current?.querySelector('[data-dialogue]') ?? wrapperRef.current)?.focus({
        preventScroll: true,
      })
    );
    // Resume is a click: the mouse can be captured again (the browser may still refuse it right
    // after an Escape; the Mouse look button stays then). Not under a crew member's line
    if (wasLocked.current && lockable && !talk) {
      lockRef.current?.domElement?.requestPointerLock()?.catch?.(() => {});
    }
    wasLocked.current = false;
  };
  // Integrity at zero: the game stops, the mouse is freed, a failing hum
  const fail = () => {
    failedRef.current = true;
    holdView();
    play('failure');
    setFailed(true);
  };
  useLayoutEffect(() => {
    failRef.current = fail;
  });
  // Reboot: back in the first room, integrity and energy full; the mission's progress is kept
  const reboot = () => {
    integrity.current = { value: 100, at: 0, pulse: 0, warned: false, since: null };
    energy.current = { value: 100, at: 0, warned: false };
    pressure.current = 0;
    slow.current = 1;
    if (hitRef.current) hitRef.current.style.opacity = '';
    writeBar(integrityBar.current, 100);
    writeBar(integritySlimBar.current, 100);
    writeBar(energyBar.current, 100);
    respawnRef.current?.();
    failedRef.current = false;
    setFailed(false);
    announce(t('demos.game.failure.rebooted'));
    requestAnimationFrame(() => wrapperRef.current?.focus({ preventScroll: true }));
  };
  // The player's own Escape, while the mouse is captured, arrives as an unlock: pause then
  const unlocked = useRef(() => {});
  useLayoutEffect(() => {
    unlocked.current = () => {
      const ours = freeing.current;
      freeing.current = false;
      if (ours || !game || !startedRef.current) return;
      if (openPanel || access || talk || complete || failed || pauseOpen) return;
      wasLocked.current = true;
      pause();
    };
  });

  const onMount = useEffectEvent(() => {
    // Back from a demo or the text-only mode with sound on: the synthesizer comes back with it
    if (soundRef.current) {
      loadSfx().then(({ createSfx }) => {
        if (!wrapperRef.current) return;
        if (!sfx.current) sfx.current = createSfx(volumeRef.current);
        if (game) sfx.current.hum(true);
      });
    }
    if (initialState || autostart) wrapperRef.current?.focus({ preventScroll: true });
  });
  // Once
  useEffect(() => {
    onMount();
    return () => {
      sfx.current?.close();
      sfx.current = null;
    };
  }, []);

  const press = (code) => {
    input.current.add(code);
    invalidateRef.current();
  };
  const release = (code) => input.current.delete(code);

  // Keys act only while the view itself has focus: a focused button keeps Space, and nothing
  // moves behind the welcome card. Escape is left to the dialog (it closes the demo); while the
  // mouse is captured, the browser takes the first Escape to release it
  const onKeyDown = (e) => {
    // The crew's dialogue is modal: if focus got out of it, keys only close it
    if (talk) {
      if (e.key === 'Escape' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        closeTalk();
      }
      return;
    }
    // Before play, Escape on Info / Controls or the story goes back to the menu; only on the menu
    // itself is it left to the dialog, which closes Game Mode
    if (game && !started && e.key === 'Escape' && screen !== 'menu') {
      e.preventDefault();
      e.stopPropagation();
      setScreen('menu');
      return;
    }
    // While Access granted hands over to a demo, or MISSION COMPLETE is on its way, no key acts
    // (E would start the hand-off again, Escape would pause over it)
    if (game && (access || missionPending.current)) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    // Escape during play pauses, wherever focus is in the view (a HUD button too); on the main
    // menu it is left to the dialog, which closes Game Mode
    if (game && started && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Not while Access granted hands over to a demo, or MISSION COMPLETE is on its way
      if (!e.repeat && !failed && !access && !missionPending.current) pause();
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || e.target !== e.currentTarget || !started) return;
    const action = KEYS[e.code];
    if (reduced && (action === 'turnLeft' || action === 'turnRight')) {
      // Reduced motion: one 45° step per press instead of a smooth turn
      e.preventDefault();
      const camera = cameraRef.current;
      if (e.repeat || !camera) return;
      camera.rotation.y += action === 'turnLeft' ? REDUCED_TURN : -REDUCED_TURN;
      onMove(camera);
      invalidateRef.current();
    } else if (action) {
      e.preventDefault();
      press(e.code);
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) toggleDoor();
    } else if (game && (e.code === 'KeyE' || e.key === 'Enter')) {
      e.preventDefault();
      if (!e.repeat) interact();
    } else if (game && e.code === 'KeyF') {
      e.preventDefault();
      if (!e.repeat) pullTrigger();
    } else if (game && /^Digit[1-9]$/.test(e.code) && Number(e.code[5]) <= WEAPON_COUNT) {
      if (!e.repeat) switchWeapon(Number(e.code[5]) - 1);
    } else if (game && e.code === 'KeyQ') {
      if (!e.repeat) switchWeapon(weapon + 1);
    } else if (game && (e.key === 'm' || e.key === 'M')) {
      if (e.repeat) return;
      // The button shows the state; from the keyboard, focus stays on the view, so say it
      toggleSound();
      announce(
        `${t('demos.game.sound')} ${t(soundRef.current ? 'demos.game.on' : 'demos.game.off')}`
      );
    }
  };
  const onKeyUp = (e) => {
    release(e.code);
    if (e.code === 'KeyF') releaseTrigger();
  };

  // Touch: dragging on the view turns (there is no pointer lock on touch screens)
  const drag = useRef(null);
  // Events from the GameInfo portal bubble here through React: only the view's own count. In
  // Game Mode the mouse's main button is the trigger, once the mouse is captured (a press before
  // that captures it)
  // A press on one of the view's own controls (a button, a link, a nested dialog) is not a shot
  // or a turn. Only what sits inside the view counts: Game Mode and the demo are dialogs too
  const onControl = (e) => {
    const control = e.target.closest('button, a, input, label, summary, details, [role=dialog]');
    return !!control && e.currentTarget.contains(control);
  };
  const onPointerDown = (e) => {
    pointerType.current = e.pointerType;
    if (talk || !e.currentTarget.contains(e.target) || onControl(e)) return;
    if (e.pointerType !== 'mouse') {
      drag.current = e.clientX;
      return;
    }
    if (!game || !started || e.button !== 0) return;
    if (lockable && !locked) lookWithMouse();
    else pullTrigger();
  };
  const onPointerMove = (e) => {
    const camera = cameraRef.current;
    if (drag.current === null || !camera) return;
    camera.rotation.y -= (e.clientX - drag.current) * 0.006;
    drag.current = e.clientX;
    looked.current = true;
    invalidateRef.current();
  };
  const endDrag = () => {
    drag.current = null;
  };

  const start = () => {
    setStarted(true);
    wrapperRef.current?.focus({ preventScroll: true });
  };
  const lookWithMouse = () => {
    start();
    // Requested here rather than through the controls' lock(), so a refusal (pointer lock asked
    // again too soon after Escape, or not allowed) is caught instead of an unhandled rejection.
    // The controls still follow the lock through pointerlockchange.
    lockRef.current?.domElement?.requestPointerLock()?.catch?.(() => {});
  };
  const onLockChange = useCallback((value) => {
    setLocked(value);
    if (value) freeing.current = false;
    else unlocked.current();
  }, []);
  // The mouse captured: keys go to the game
  useEffect(() => {
    if (locked) wrapperRef.current?.focus({ preventScroll: true });
  }, [locked]);

  // Game Mode on a touch screen: a tap on the view fires (the mouse fires from onPointerDown)
  const onClick = (e) => {
    if (
      !game ||
      talk ||
      !started ||
      pointerType.current === 'mouse' ||
      !e.currentTarget.contains(e.target) ||
      onControl(e)
    )
      return;
    fire(true);
  };

  // Releasing keys when focus leaves keeps the player from walking on alone
  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) input.current.clear();
  };
  useEffect(() => {
    const keys = input.current;
    const trigger = firing.current;
    const clear = () => {
      keys.clear();
      trigger.held = false;
    };
    window.addEventListener('blur', clear);
    return () => window.removeEventListener('blur', clear);
  }, []);
  // Away from the game (another window, another tab) during play: it pauses, so threats do not
  // close in on a player who cannot see them (a pointer-lock release already does the same)
  const pauseIfPlaying = useEffectEvent(() => {
    const busy = pauseOpen || openPanel || talk || access || complete || failed;
    if (game && started && !busy) pause();
  });
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === 'hidden' || !document.hasFocus()) pauseIfPlaying();
    };
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', away);
    return () => {
      window.removeEventListener('blur', away);
      document.removeEventListener('visibilitychange', away);
    };
  }, []);

  // Touch buttons act while held; a click with no hold behind it (Enter or Space, a screen
  // reader's double tap, a switch) takes one short step instead
  const nudge = (code) => {
    press(code);
    window.setTimeout(() => release(code), 250);
  };
  const hold = (code) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      press(code);
    },
    onPointerUp: () => release(code),
    onPointerLeave: () => release(code),
    onPointerCancel: () => release(code),
    onClick: (e) => {
      if (e.detail === 0 || !input.current.has(code)) nudge(code);
    },
  });

  const onCreated = useCallback(
    ({ gl, invalidate }) => {
      invalidateRef.current = invalidate;
      gl.domElement.setAttribute('role', 'img');
      gl.domElement.setAttribute('aria-label', t(`demos.${game ? 'game' : 'cub3d'}.canvasLabel`));
      // Demand mode: a restored context stays blank until something asks for a frame
      gl.domElement.addEventListener('webglcontextrestored', () => invalidate());
    },
    [t, game]
  );

  // Game Mode draws every frame while playing (the threats and the weapon move); paused (the
  // menu, a dialog, Access granted), or with reduced motion (nothing moves on its own), on demand
  const stopped = !!openPanel || access || !!talk || !!complete || pauseOpen || failed;
  const playing = game && started && !stopped && !reduced;
  // The threats hold still, and wear nothing down, whenever the game is not being played: the
  // menu, a wall's text or the contact form, Access granted, a crew member talking. Frames still
  // run then (the energy refill draws), so they must be told, not just left undrawn
  const held = game && (!started || stopped);
  // The mission's clock runs only while the game is played (or goes on from a snapshot): reading a
  // dossier, talking to the crew or a pause does not count as time
  useEffect(() => {
    if (!game) return;
    const c = missionClock.current;
    if (!held && c.since === null) c.since = timeNow();
    if (held && c.since !== null) {
      c.total += timeNow() - c.since;
      c.since = null;
    }
  }, [game, held]);
  // The tracker's list: the sections in order, ticked once read
  const sectionList = useMemo(
    () =>
      SECTIONS.map((id) => ({
        id,
        title: panelTitle(t, id, true),
        found: discovered.includes(id),
      })),
    [t, discovered]
  );
  useLayoutEffect(() => {
    paused.current = held;
  }, [held]);
  const [watching, setWatching] = useState(false);
  // Each stretch of play warms up again
  useEffect(() => {
    if (!playing) return undefined;
    const id = setTimeout(() => setWatching(true), WARMUP_MS);
    return () => {
      clearTimeout(id);
      setWatching(false);
    };
  }, [playing]);

  return (
    <div
      ref={wrapperRef}
      // In Game Mode the view is reached through the briefing's Start buttons, which focus it
      tabIndex={game && !started ? -1 : 0}
      // Not over Game Mode's menu: its story and controls are text to read, not a game to play
      role={game && !started ? undefined : 'application'}
      aria-label={
        game && !started ? undefined : t(game ? 'demos.game.title' : 'demos.cub3d.appLabel')
      }
      aria-describedby={helpId}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        endDrag();
        releaseTrigger();
      }}
      onPointerCancel={endDrag}
      onClick={onClick}
      onWheel={onWheel}
      className='group relative h-full w-full touch-none overflow-hidden bg-background outline-hidden'
    >
      <Canvas
        frameloop={playing ? 'always' : 'demand'}
        // Full screen in Game Mode: a lower pixel ratio and no MSAA (the textures are pixel art)
        dpr={game ? tierDpr(graphics, quality) : DEMO_DPR}
        gl={game ? GAME_GL : DEMO_GL}
        // Game Mode: the flashlight's shadows, and tone mapping left to the post-processing (or
        // none at all in high contrast)
        shadows={game}
        flat={game}
        camera={CAMERA}
        onCreated={onCreated}
      >
        <Scene
          world={world}
          input={input}
          lookedRef={looked}
          solid={solid}
          doorCells={doorCells}
          closedDoors={closedDoors}
          panels={panels}
          onMove={onMove}
          lockable={lockable}
          lockRef={lockRef}
          onLockChange={onLockChange}
          spawn={initialState}
          reduced={reduced}
          facility={game}
          flat={flat}
          weapon={weapon}
          motion={motion}
          postFx={postFx}
          hologramLabel={t('demos.game.hologram')}
          discovered={discovered}
          targetRef={targetRef}
          guideRef={guideRef}
          noFlash={noFlash}
          graphics={graphics}
          slow={slow}
          hitStop={hitStop}
          respawnRef={respawnRef}
          hubLitRef={hubLit}
          nearRef={nearAhead}
        />
        {game && (
          <GameLayer
            enemies={enemies}
            npcs={npcs}
            labels={threatLabels}
            icons={techIcons}
            solid={solid}
            reduced={reduced}
            noFlash={noFlash}
            flat={flat}
            paused={paused}
            pressure={pressure}
            slow={slow}
            hitStop={hitStop}
            fxRef={fxRef}
            crosshairRef={crosshairRef}
            motion={motion}
            onTick={onTick}
          />
        )}
        {game && <DoorLabel label={doorLabel} />}
        {/* Watches the frame rate only while it runs every frame, after the warm-up: the
            resolution steps down on a lasting dip and back up when there is room; after three
            changes of direction it stays where it is for the session */}
        {watching && graphics === 'medium' && !flat && !settled && (
          <PerformanceMonitor factor={factor} onIncline={onIncline} onDecline={onDecline} />
        )}
      </Canvas>

      {/* HUD */}
      {game ? (
        // The tactical radar: the whole map, with threats and crew seen through walls. A visual
        // aid (its legend too): the same places and people are announced and in the text-only mode
        <div
          aria-hidden='true'
          className='pointer-events-none absolute right-3 top-44 z-30 hidden sm:top-16 sm:block'
        >
          <canvas
            ref={radarRef}
            className='rounded-md border border-line-strong'
            style={{ width: W * RADAR_CELL, height: H * RADAR_CELL }}
          />
          {/* As wide as the radar at most: it wraps (French runs longer) */}
          <p
            className='ml-auto mt-1 flex flex-wrap justify-end gap-x-3 gap-y-0.5 rounded-md bg-background px-2 py-0.5 text-xs text-foreground'
            style={{ maxWidth: W * RADAR_CELL }}
          >
            {RADAR_LEGEND.map(({ key, color, shape }) => (
              <span key={key} className='inline-flex items-center gap-1'>
                <svg viewBox='0 0 10 10' className={`h-2.5 w-2.5 ${color}`}>
                  {shape}
                </svg>
                {t(`demos.game.radar.${key}`)}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <canvas
          ref={minimapRef}
          aria-hidden='true'
          className='pointer-events-none absolute right-3 top-3 z-30 rounded-md border border-line-strong'
          style={{ width: W * MINIMAP_CELL, height: H * MINIMAP_CELL }}
        />
      )}
      <p
        id={helpId}
        className={
          // Game Mode has the status bar there; the keys stay in the briefing and the description
          game
            ? 'sr-only'
            : 'absolute bottom-3 left-3 z-30 max-w-md rounded-xl bg-background/80 px-3 py-2 text-sm text-foreground-muted'
        }
      >
        {/* The welcome card's key list, as a reminder */}
        {t(keysKey).join(' · ')}
      </p>
      {/* The wall panels' text, for anyone who cannot see or reach them in the maze (Game Mode
          has its text-only mode instead) */}
      {started && !game && (
        <details className='absolute left-3 top-3 z-30 max-h-[60%] max-w-xs overflow-y-auto rounded-xl bg-background/90 p-3 text-sm text-foreground'>
          <summary className={`cursor-pointer rounded-sm font-semibold ${styles.hudFocus}`}>
            {t('demos.cub3d.panelsHeading')}
          </summary>
          {panels.map(({ id, title, lines }) => (
            <section key={id} className='mt-2'>
              <h3 className='font-bold text-primary-400'>{title}</h3>
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </section>
          ))}
        </details>
      )}

      {lockable && started && !locked && (
        // In Game Mode bottom left, above the status bar: the weapon panel holds the bottom right
        <button
          type='button'
          onClick={lookWithMouse}
          className={`absolute z-30 inline-flex ${game ? 'bottom-12 left-3' : 'bottom-3 right-3'} h-11 items-center rounded-xl border border-line-strong bg-glass px-4 text-sm font-semibold text-foreground backdrop-blur-md hover:border-foreground-muted ${styles.hudFocus}`}
        >
          {t('demos.cub3d.mouseLook')}
        </button>
      )}

      {touch && started && (
        <div
          // Game Mode: bottom left, under the left thumb, clear of the radar (the radar and the
          // weapon card hold the right; there is no Mouse look button on touch)
          className={`absolute z-30 grid grid-cols-3 gap-1.5 ${game ? 'bottom-12 left-3' : 'bottom-16 right-3'}`}
          role='group'
          aria-label={t('demos.cub3d.touch.label')}
        >
          {TOUCH_MOVES.map(([code, action, glyph, place]) => (
            <button
              key={code}
              type='button'
              aria-label={t(`demos.cub3d.touch.${action}`)}
              className={`${TOUCH_BUTTON} ${place}`}
              {...hold(code)}
            >
              <span aria-hidden='true'>{glyph}</span>
            </button>
          ))}
          <button
            type='button'
            onClick={game ? interact : toggleDoor}
            className={`${TOUCH_BUTTON} col-start-2 row-start-3 w-auto px-2 text-xs`}
          >
            {t(game ? 'demos.game.use' : 'demos.cub3d.touch.door')}
          </button>
          {game && (
            // The next weapon (keys 1 to 3, Q and the wheel on a computer)
            <button
              type='button'
              aria-label={t('demos.game.switchWeapon')}
              onClick={() => switchWeapon(weapon + 1)}
              className={`${TOUCH_BUTTON} col-start-3 row-start-1 w-auto px-1 text-xs`}
            >
              {t('demos.game.weaponButton')}
            </button>
          )}
        </div>
      )}

      {!started && game && (
        <MainMenu
          t={t}
          screen={screen}
          onScreen={setScreen}
          keys={t(keysKey)}
          lockable={lockable}
          onStart={start}
          onStartLook={lookWithMouse}
          // No run yet: back from the text, the world opens on this menu again
          onTextMode={() => onTextMode(null)}
          onExit={onExit}
          settings={settings}
          focusOnMount={rerun}
        />
      )}
      {!started && !game && (
        // Scrolls on short or zoomed screens, so Start is always reachable
        <div className='absolute inset-0 z-40 flex overflow-y-auto bg-background/70 p-4 backdrop-blur-sm motion-safe:animate-backdrop-in'>
          <div className='m-auto w-full max-w-lg rounded-3xl border border-line bg-glass-strong p-6 shadow-raised'>
            <h3 className='text-2xl font-black text-foreground'>
              {t('demos.cub3d.welcome.title')}
            </h3>
            <p className='mt-3 leading-relaxed text-foreground-muted'>
              {t('demos.cub3d.welcome.body')}
            </p>
            <ul className='mt-4 space-y-1 text-sm text-foreground'>
              {t(keysKey).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className='mt-5 flex flex-wrap gap-3'>
              <button type='button' onClick={start} className={styles.buttonPrimary}>
                {t('demos.cub3d.welcome.start')}
              </button>
              {lockable && (
                <button type='button' onClick={lookWithMouse} className={styles.buttonGhost}>
                  {t('demos.cub3d.welcome.startLook')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Not behind the menu, whose own settings would otherwise be in the tab order twice */}
      {game && started && (
        <GameHud
          t={t}
          aim={target && !KIND[target] ? aimText(t, ENEMIES, target) : null}
          aimFar={far}
          prompt={target && KIND[target] ? panelTitle(t, target, true) : null}
          promptKeyOnly={KIND[target] === 'section' || KIND[target] === 'terminal'}
          sections={sectionList}
          kills={kills}
          threats={ENEMIES.length}
          room={room}
          weapon={weapon}
          toast={toast}
          access={access}
          onTextMode={() => onTextMode(snapshot())}
          onExit={onExit}
          confirmExit={touch}
          onPointerDone={focusView}
          crosshairRef={crosshairRef}
          hitMarkerRef={hitMarkerRef}
          energyBar={energyBar}
          integrityBar={integrityBar}
          integritySlimBar={integritySlimBar}
          hitRef={hitRef}
          slowed={slowed}
          onPause={pause}
          hubFlash={hubFlash}
          noFlash={noFlash}
        />
      )}
      {pauseOpen && (
        <PauseMenu
          t={t}
          onResume={resume}
          onRestart={() => onRestart(true)}
          onMenu={() => onRestart(false)}
          resumeHref={person.resume}
          settings={settings}
        />
      )}
      {failed && <SystemFailure t={t} onReboot={reboot} onMenu={() => onRestart(false)} />}
      {talk && (
        <NpcDialogue
          t={t}
          name={t(`demos.game.npcs.${talk}.name`)}
          line={`${t(`demos.game.npcs.${talk}.line`)} ${t(`demos.game.npcs.${talk}.hint`)}`}
          reduced={reduced}
          onClose={closeTalk}
        />
      )}
      {openPanel && (
        <GameInfo
          t={t}
          dark={game}
          title={panelTitle(t, openPanel, game)}
          kicker={dossierKicker(t, openPanel, game)}
          detail={openPanel === HUB.id ? hubDetail(t, sectionList, t(keysKey)) : details[openPanel]}
          onClose={closePanel}
          // Game Mode's dossiers are terminals: typed out (with a quiet tick when sound is on), a
          // scan-line overlay, and a Close terminal button
          terminal={game}
          reduced={reduced}
          noFlash={noFlash}
          onType={() => play('tick')}
          closeLabel={game ? t('demos.game.closeTerminal') : undefined}
        >
          {openPanel === 'contact' && <ContactForm />}
          {game && openPanel === 'projects' && (
            <div className='mt-4 flex flex-wrap gap-3'>
              {['cub3d', 'fdf'].map((id) => (
                <button
                  key={id}
                  type='button'
                  onClick={() => runDemo(id)}
                  className={styles.buttonGhost}
                >
                  {t('demos.game.runDemo', { name: t(`demos.${id}.name`) })}
                </button>
              ))}
            </div>
          )}
        </GameInfo>
      )}
      {complete && (
        <MissionComplete
          t={t}
          body={t(
            complete.by === 'threats' ? 'demos.game.mission.bodyThreats' : 'demos.game.mission.body'
          )}
          time={minutes(complete.time)}
          kills={kills}
          threats={ENEMIES.length}
          accuracy={
            complete.shots.fired
              ? `${Math.round((complete.shots.hit / complete.shots.fired) * 100)}%`
              : t('demos.game.mission.noShots')
          }
          resume={person.resume}
          github={person.github}
          // The Contact dossier, read as at its wall: Contact is ticked off
          onContact={() => {
            setComplete(null);
            readPanel('contact');
          }}
          onClose={closeComplete}
        />
      )}

      <p role='status' className='sr-only'>
        {message}
      </p>
      {/* What is in the crosshair, in its own region: it does not cut off the other messages */}
      {game && (
        <p role='status' className='sr-only'>
          {aimSaid}
        </p>
      )}
      {/* The focus ring, drawn above the opaque canvas */}
      <span aria-hidden='true' className={styles.viewFocusRing} />
    </div>
  );
};

export default Cub3DWorld;
