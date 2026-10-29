import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
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
import { GameHud, GameInfo, MainMenu, NpcDialogue } from './GameHud';
import { MAP_CUB, parseCub } from './map';
import {
  ENEMIES,
  GAME_DOORS,
  GAME_PANELS,
  NPCS,
  PROP_BOXES,
  WEAPON_COUNT,
  WEAPON_FX,
  roomAt,
} from './rooms';

// Game Mode's look (lit materials, props, flashlight, post-processing): its own chunk, so the
// cub3D demo never loads it
const Facility = lazy(() => import('./Facility'));

// A web homage to cub3D: the project's own map.cub as a first-person maze. The original casts
// one ray per screen column; here three.js draws the walls as boxes, and the minimap shows the
// rays, stepping from grid line to grid line as the original does. With `game` (Game Mode) it
// adds a HUD, and the wall panels open when aimed at.

const WORLD = parseCub(MAP_CUB);
// The grid, for the hot paths (movement, line of sight, minimap): cell index is z * W + x
const { width: W, height: H, walkable: WALKABLE, doors: DOOR_CELLS } = WORLD;
const EYE = 0.5; // walls are 1 high: the eye is halfway, as in a raycaster
const FOV = 60; // horizontal, the original's FOV_ANGLE
const MOVE_SPEED = 3; // cells per second (the original: SPEED 4 of a 64-unit cell per frame)
const TURN_SPEED = 3; // radians per second (the original: 0.05 per frame)
const REDUCED_TURN = Math.PI / 4; // with reduced motion, each arrow press turns one step
const RADIUS = 0.2; // how close the player gets to a wall
const MINIMAP_CELL = 6; // px
const MINIMAP_RAYS = 24;
const RADAR_CELL = 9; // px: Game Mode's tactical radar draws the whole map larger
const RADAR_CONE = 3; // cells: the length of the player's view cone on the radar
// Distance shading: three.js fog on the walls, floor and ceiling, from FOG_NEAR to black at FOG_FAR
const FOG_NEAR = 1.5;
const FOG_FAR = 14;
const AIM_RANGE = 8; // cells: how far away a wall panel can be opened
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
    key: 'crew',
    color: 'text-primary-400',
    shape: <path d='M5 0l5 5-5 5-5-5z' fill='currentColor' />,
  },
  {
    key: 'doors',
    color: 'text-info',
    shape: <rect x='1' y='1' width='8' height='8' fill='currentColor' />,
  },
]; // cells: how close a closed door shows where it leads
const DOOR_REACH = [0.8, 1.6]; // cells ahead where E (or Space) finds a door
const TOAST_MS = 8000; // long enough to read the fact (it is also in the text-only mode)
// Canvas options, made once (R3F re-applies `gl` whenever it is a new object)
const GAME_DPR = [1, 1.5];
// Game Mode drops to this when the frame rate sags (PerformanceMonitor): 44% fewer pixels at 1080p
const LOW_DPR = 0.75;
const DEMO_DPR = [1, 2];
const GAME_GL = { powerPreference: 'default', antialias: false };
const DEMO_GL = { powerPreference: 'default' };
const CAMERA = { fov: 50, near: 0.05, far: 60 };
const CONTRAST_KEY = 'game-contrast';
const VOLUME_KEY = 'game-volume';
// Fills a HUD bar to `value` (0 to 100), only when its whole percent changes
const writeBar = (el, value) => {
  if (!el) return;
  const v = Math.round(value);
  if (el.dataset.value === String(v)) return;
  el.dataset.value = String(v);
  el.style.transform = `scaleX(${v / 100})`;
  el.dataset.low = String(v < 30);
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

const isFloor = (x, z) => x >= 0 && z >= 0 && x < W && z < H && WALKABLE[z * W + x] === 1;

// Wall boxes only where they can be seen: every non-floor cell next to (or diagonal to) a floor
// cell, so the enclosed area has no gaps whatever the map holds outside it
const shellCells = () => {
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

// Game Mode adds doors between its rooms (rooms.js) to map.cub's own
const GAME_DOOR_CELLS = [...DOOR_CELLS, ...GAME_DOORS.map(([x, z]) => z * W + x)];
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
      position={[(label.cell % W) + 0.5, 0.85, Math.floor(label.cell / W) + 0.5]}
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
  input,
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
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const walls = useRef(null);
  const doorMesh = useRef(null);
  // Each door's height, eased between 1 (closed) and 0 (sunk into the floor)
  const doorHeights = useRef({});
  const panelEls = useRef({});
  // The panels within fog range: only those are mounted (a transformed drei Html restyles itself
  // every frame, so far-off panels would cost DOM work for nothing)
  const [near, setNear] = useState(() => new Set());
  const moving = useRef(false);
  const shell = useMemo(shellCells, []);

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
  useLayoutEffect(() => {
    const { x, z, yaw } = spawn ?? WORLD.player;
    camera.rotation.order = 'YXZ';
    camera.position.set(x, EYE, z);
    camera.rotation.set(0, yaw, 0);
    onMove(camera);
    // The first frame may already have been drawn from the default camera
    invalidate();
    // Once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // three.js takes a vertical FOV: derive it from the original's 60° horizontal one
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    camera.fov = (2 * Math.atan(Math.tan((FOV * Math.PI) / 360) / aspect) * 180) / Math.PI;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);

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

  // Game Mode's mouse look: the mouse sets where the view is headed and the view eases there, a
  // little inertia (the controls themselves only capture the mouse). Instant with reduced motion
  const yawTarget = useRef(null);
  useEffect(() => {
    if (!facility || !lockable) return undefined;
    const onMouse = (e) => {
      if (document.pointerLockElement !== gl.domElement) return;
      yawTarget.current = (yawTarget.current ?? camera.rotation.y) - e.movementX * 0.002;
      input.looked = true;
      invalidate();
    };
    document.addEventListener('mousemove', onMouse);
    return () => document.removeEventListener('mousemove', onMouse);
  }, [facility, lockable, gl, camera, input, invalidate]);

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
      moving ||= next !== target;
    });
    if (changed) mesh.instanceMatrix.needsUpdate = true;
    if (moving) state.invalidate();
  }, -1);

  // Held keys move the player; demand mode renders only while something moves
  useFrame((state, delta) => {
    const held = input.current;
    if (!held.size && !input.looked && yawTarget.current === null) {
      moving.current = false;
      return;
    }
    // In demand mode the first frame's delta spans the whole pause before it: one step instead
    const dt = moving.current ? Math.min(delta, 0.1) : 1 / 60;
    moving.current = true;
    if (yawTarget.current !== null) {
      const target = yawTarget.current;
      const next = reduced ? target : MathUtils.damp(camera.rotation.y, target, 20, dt);
      camera.rotation.y = Math.abs(next - target) < 1e-4 ? target : next;
      if (camera.rotation.y === target) yawTarget.current = null;
      else state.invalidate();
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
    if (turn && !reduced) {
      if (yawTarget.current !== null) yawTarget.current += turn * TURN_SPEED * dt;
      else camera.rotation.y += turn * TURN_SPEED * dt;
    }
    if (forward || strafe) {
      const yaw = camera.rotation.y;
      const step = (reduced ? MOVE_SPEED / 2 : MOVE_SPEED) * dt;
      const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * step;
      const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * step;
      // Each axis on its own, so the player slides along a wall instead of stopping dead
      if (free(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
      if (free(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
    }
    input.looked = false;
    onMove(camera);
    if (held.size) state.invalidate();
  }, -2);

  // Stable handlers: drei re-subscribes the controls whenever they change
  const onLook = useCallback(() => {
    input.looked = true;
  }, [input]);
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
            postFx={postFx}
            hologramLabel={hologramLabel}
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
            <meshBasicMaterial color={`rgb(${WORLD.floor.join(',')})`} />
          </mesh>
          <mesh position={[W / 2, 1, H / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W + 2, H + 2]} />
            <meshBasicMaterial color={`rgb(${WORLD.ceiling.join(',')})`} />
          </mesh>
        </>
      )}
      {panels
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

// What is in the crosshair: the nearest live threat or crew member on the view's center line,
// closer than the wall it meets, else the panel hanging where that line meets the wall. Returns
// an id or null
const aimAt = (camera, solid, panels, enemies, npcs = []) => {
  const { x, z } = camera.position;
  const yaw = camera.rotation.y;
  const [hx, hz] = castRay(x, z, yaw, solid);
  const wall = Math.hypot(hx - x, hz - z);
  const dx = -Math.sin(yaw);
  const dz = -Math.cos(yaw);
  let hit = null;
  let nearest = Math.min(wall, AIM_RANGE);
  const consider = (thing, radius) => {
    const ex = thing.x - x;
    const ez = thing.z - z;
    const along = ex * dx + ez * dz;
    if (along <= 0 || along >= nearest || Math.abs(ex * dz - ez * dx) >= radius) return;
    hit = thing.id;
    nearest = along;
  };
  enemies.forEach((enemy) => enemy.alive && consider(enemy, ENEMY_RADIUS));
  npcs.forEach((npc) => consider(npc, NPC_RADIUS));
  if (hit || wall > AIM_RANGE) return hit;
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
    if (!enemy.alive) return false;
    const d = Math.hypot(enemy.x - x, enemy.z - z);
    const bearing = Math.atan2(-(enemy.x - x), -(enemy.z - z));
    const off = Math.abs(MathUtils.euclideanModulo(bearing - yaw + Math.PI, 2 * Math.PI) - Math.PI);
    return d < range && off < cone && clearLine(x, z, enemy.x, enemy.z, solid);
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

// Panels that open something else than their own text (Game Mode's rooms.js)
const KIND = Object.fromEntries(GAME_PANELS.map(({ id, kind }) => [id, kind]));
const panelTitle = (t, id) =>
  t(KIND[id] === 'info' || !KIND[id] ? `demos.cub3d.panels.${id}` : `demos.game.panels.${id}`);
const NPC_IDS = new Set(NPCS.map(({ id }) => id));
// What the crosshair is on (a threat, a crew member or a panel id), as the HUD shows and
// announces it
const aimText = (t, enemies, id) => {
  const enemy = enemies.find((e) => e.id === id);
  if (enemy) return t('demos.game.aimEnemy', { name: t(`demos.game.enemies.${enemy.type}`) });
  if (NPC_IDS.has(id)) return t('demos.game.aimNpc', { name: t(`demos.game.npcs.${id}.name`) });
  return t('demos.game.aim', { name: panelTitle(t, id) });
};
// The rooms on either side of each door; one joining two rooms gets a title (where it leads)
const DOOR_ROOMS = new Map(
  GAME_DOOR_CELLS.map((cell) => {
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
}) => {
  const touch = useMediaQuery('(pointer: coarse)');
  const reduced = usePrefersReducedMotion();
  const lockable = !touch && 'exitPointerLock' in document;
  let keysKey = 'demos.cub3d.welcome.keys';
  if (touch) keysKey = 'demos.cub3d.welcome.keysTouch';
  else if (game) keysKey = 'demos.game.keys';
  const [started, setStarted] = useState(!!initialState);
  // Game Mode's main menu: 'menu', 'story' (Play) or 'info'
  const [screen, setScreen] = useState('menu');
  // For the frame loop's aim: nothing is announced while the briefing covers the view
  const startedRef = useRef(started);
  startedRef.current = started;
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('');
  const wrapperRef = useRef(null);
  const minimapRef = useRef(null);
  const staticLayer = useRef(null);
  const radarRef = useRef(null);
  const radarLayer = useRef(null);
  const radarDue = useRef(0);
  // The radar shows from the sm breakpoint
  const radarShown = useRef(true);
  const wideEnough = useMediaQuery('(min-width: 640px)');
  radarShown.current = wideEnough;
  const lockRef = useRef(null);
  const input = useRef(new Set());
  // Door state: React state to draw the door meshes, mirrored in a ref for the movement loop.
  // Game Mode has its doors between rooms as well as map.cub's
  const doorCells = game ? GAME_DOOR_CELLS : DOOR_CELLS;
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
  const enemies = useRef(
    ENEMIES.map((enemy) => {
      const saved = initialState?.enemies.find(({ id }) => id === enemy.id);
      const [cx, cz] = enemy.cell;
      return { ...enemy, x: cx + 0.5, z: cz + 0.5, alive: true, node: null, ...saved };
    })
  );
  const [kills, setKills] = useState(() => enemies.current.filter((e) => !e.alive).length);
  // The crew: fixed (rooms.js); `paused` holds the threats while one of them talks
  const npcs = useRef(NPCS.map((npc) => ({ ...npc, x: npc.cell[0] + 0.5, z: npc.cell[1] + 0.5 })));
  const paused = useRef(false);
  const [talk, setTalk] = useState(null);
  // The closed door near the player, with where it leads: { cell, text }
  const [doorLabel, setDoorLabel] = useState(null);
  const nearDoor = useRef('');
  const nearDoorCell = useRef(-1);
  const doorSaid = useRef({ key: '', at: -Infinity });
  // The trigger: held (automatic weapons keep firing) and when the gun that last fired is ready
  const firing = useRef({ held: false, ready: -Infinity });
  const fireRef = useRef(() => {});
  const pointerType = useRef('mouse');
  const [room, setRoom] = useState(null);
  const roomRef = useRef(null);
  const [weapon, setWeapon] = useState(initialState?.weapon ?? 0);
  // Mirrors of `read` and `weapon` for snapshots, which can be taken from a timer
  const readRef = useRef(read);
  const weaponState = useRef(weapon);
  const [toast, setToast] = useState(null);
  const [access, setAccess] = useState(false);
  const [sound, setSound] = useState(initialState?.sound ?? false);
  const soundRef = useRef(sound);
  const sfx = useRef(null);
  const fxRef = useRef(null);
  // Set by a shot, eased back to 0 by GameMotion (which adds the gauntlet's bob and sway)
  const motion = useRef({ recoil: 0, shake: 0 });
  // The HUD's crosshair (its spread), energy and integrity bars and hit flash, written per frame
  const crosshairRef = useRef(null);
  const energyBar = useRef(null);
  const integrityBar = useRef(null);
  const hitRef = useRef(null);
  // Energy: each shot costs some (WEAPON_FX), refilled shortly after the last one. Integrity:
  // worn down while threats are close (`pressure`, counted by the threats), restored after
  const energy = useRef({ value: 100, at: 0, warned: false });
  const integrity = useRef({ value: 100, at: 0, pulse: 0, warned: false });
  const pressure = useRef(0);
  // The chromatic aberration's pulse (Facility eases it back)
  const postFx = useRef({ aberration: 0 });
  // High contrast mode (bright flat colors, no fog or post-processing) and the master volume:
  // per-viewer settings, remembered when the browser lets us
  const prefersContrast = useMediaQuery('(prefers-contrast: more)');
  const [contrast, setContrast] = useState(() => {
    try {
      const saved = localStorage.getItem(CONTRAST_KEY);
      return saved === null ? null : saved === '1';
    } catch {
      return null;
    }
  });
  const flat = contrast ?? prefersContrast;
  const [volume, setVolume] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(VOLUME_KEY));
      return localStorage.getItem(VOLUME_KEY) !== null && saved >= 0 && saved <= 1 ? saved : 0.7;
    } catch {
      return 0.7;
    }
  });
  const volumeRef = useRef(volume);
  const [lowRes, setLowRes] = useState(false);
  const lowerRes = useCallback(() => setLowRes(true), []);
  const stride = useRef(null);
  const allReadAnnounced = useRef(false);
  const timers = useRef({});
  const panelList = game ? GAME_PANELS : PANELS;

  // Walls, closed doors and anything outside the enclosed area block the way
  const solid = useCallback(
    (cx, cz) => !isFloor(cx, cz) || doors.current[cz * W + cx] === true,
    []
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
        return { ...panel, title: panelTitle(t, panel.id), lines };
      }),
    [t, technologies, projects, panelList, game]
  );
  // The sprites' labels: threat types and the crew's names
  const threatLabels = useMemo(
    () => ({
      ddos: t('demos.game.enemies.ddos'),
      sql: t('demos.game.enemies.sql'),
      ...Object.fromEntries(NPCS.map(({ id }) => [id, t(`demos.game.npcs.${id}.name`)])),
    }),
    [t]
  );

  // Read once: the page (and its theme toggle) is inert while the demo is open
  const colors = useMemo(() => {
    const c = readTheme([
      'foreground',
      'foreground-muted',
      'background',
      'primary',
      'primary-400',
      'danger',
      'success',
      'info',
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
      crew: rgb(c['primary-400']),
      door: rgb(c.info),
      sweep: rgb(c.success),
    };
  }, []);

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
  }, [colors, doorCells]);

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
      // Told apart by shape as well as color: threats are crosses, the crew diamonds
      ctx.strokeStyle = colors.threat;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'square';
      ctx.beginPath();
      enemies.current.forEach((e) => {
        if (!e.alive) return;
        ctx.moveTo(e.x * s - 3, e.z * s - 3);
        ctx.lineTo(e.x * s + 3, e.z * s + 3);
        ctx.moveTo(e.x * s + 3, e.z * s - 3);
        ctx.lineTo(e.x * s - 3, e.z * s + 3);
      });
      ctx.stroke();
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
    [colors, doorCells, reduced]
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
    [colors, paintStatic, solid]
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
      if (radarShown.current && (reduced || radarDue.current <= 0)) {
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
      const now = performance.now();
      const en = energy.current;
      if (now - en.at > 350 && en.value < 100) {
        en.value = Math.min(100, en.value + 40 * dt);
        invalidateRef.current();
      }
      if (en.warned && en.value >= 100) en.warned = false;
      // Threats close by wear integrity down, in pulses (a hit flash and aberration, a sound)
      const hp = integrity.current;
      const hurt = pressure.current;
      if (hurt) {
        hp.value = Math.max(0, hp.value - 12 * hurt * dt);
        hp.at = now;
        hp.pulse -= dt;
        if (hp.pulse <= 0) {
          hp.pulse = 0.5;
          postFx.current.aberration = 1;
          motion.current.shake = Math.max(motion.current.shake, 0.4);
          if (soundRef.current) sfx.current?.hit();
          if (!reduced) hitRef.current?.animate?.([{ opacity: 0.85 }, { opacity: 0 }], 420);
        }
        if (hp.value < 30 && !hp.warned) {
          hp.warned = true;
          announce(t('demos.game.integrityLow'));
        }
      } else {
        hp.pulse = 0;
        if (now - hp.at > 1500 && hp.value < 100) {
          hp.value = Math.min(100, hp.value + 8 * dt);
          invalidateRef.current();
        }
        if (hp.value > 60) hp.warned = false;
      }
      writeBar(energyBar.current, en.value);
      writeBar(integrityBar.current, hp.value);
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
          door === null ? null : { cell: door, text: t('demos.game.doorLabel', { place: name }) }
        );
        // Once per door, again only after a while
        const now = performance.now();
        if (door !== null && (key !== doorSaid.current.key || now - doorSaid.current.at > 15000)) {
          doorSaid.current = { key, at: now };
          announce(t('demos.game.doorNear', { place: name }));
        }
      }
      const aimed = aimAt(camera, solid, GAME_PANELS, enemies.current, npcs.current);
      if (aimed === targetRef.current) return;
      targetRef.current = aimed;
      setTarget(aimed);
      window.clearTimeout(aimTimer.current);
      if (!aimed) {
        setAimSaid('');
        return;
      }
      const text = aimText(t, enemies.current, aimed);
      aimTimer.current = window.setTimeout(() => setAimSaid(text), 300);
    },
    [announce, solid, t, drawRadar, doorCells, reduced]
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
        // A footstep every STRIDE cells walked
        const last = (stride.current ??= { x, z, left: STRIDE });
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
    [drawMinimap, announce, t, game]
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
    doors.current = { ...doors.current, [ahead]: closed };
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
      x: camera?.position.x ?? WORLD.player.x,
      z: camera?.position.z ?? WORLD.player.z,
      yaw: camera?.rotation.y ?? WORLD.player.yaw,
      doors: doors.current,
      read: readRef.current,
      weapon: weaponState.current,
      sound: soundRef.current,
      enemies: enemies.current.map(({ id, x, z, alive }) => ({ id, x, z, alive })),
    };
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
    // Reduced motion draws on demand: the hidden threat must be redrawn away
    invalidateRef.current();
    setKills((n) => n + 1);
    // The fact shows in the HUD's own live region, which announces it
    setToast({
      key: enemy.id,
      title: t(`demos.game.facts.${enemy.type}.title`),
      body: t(`demos.game.facts.${enemy.type}.body`),
    });
    later('toast', () => setToast(null), TOAST_MS);
  };

  // Before a dialog or a talk: the mouse is freed, keys let go, and no recoil or shake is left
  // frozen mid-way while the view pauses
  const holdView = () => {
    lockRef.current?.unlock();
    input.current.clear();
    firing.current.held = false;
    motion.current = { recoil: 0, shake: 0 };
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

  // Game Mode. E, Enter or the touch Use button acts on what is in the crosshair: a crew member
  // talks, a panel opens (its text, the contact form, or after "Access granted" a terminal's live
  // demo). Nothing in the crosshair works the door ahead
  const interact = () => {
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
      talkTo(id);
      return;
    }
    holdView();
    if (!readRef.current.includes(id)) readRef.current = [...readRef.current, id];
    setRead(readRef.current);
    play('blip');
    if (KIND[id] === 'terminal') {
      setAccess(true);
      announce(t('demos.game.accessGranted'));
      later('access', () => onOpenDemo(id, snapshot()), reduced ? 400 : 700);
    } else {
      setOpenPanel(id);
    }
  };

  // Fires the weapon in hand (WEAPON_FX): `press` is a click or F, otherwise an automatic
  // weapon's next shot while the trigger is held. A press on a panel or a crew member uses it
  // instead. Each weapon has its own shake, recoil, sound and particles: the rifle a trail to the
  // target, the pistol blocks where it lands, the blaster a burst on everything in its cone
  const fire = (press) => {
    const cfg = WEAPON_FX[weaponState.current];
    const now = performance.now();
    const camera = cameraRef.current;
    if (!camera || (!press && !cfg.auto) || now < firing.current.ready) return;
    const id = targetRef.current;
    if (press && id && (KIND[id] || NPC_IDS.has(id))) {
      interact();
      return;
    }
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
    firing.current.ready = now + cfg.cooldown * 1000;
    motion.current.recoil = cfg.kick;
    motion.current.shake = cfg.shake;
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
      : enemies.current.filter((e) => e.alive && e.id === id);
    let impacts = hits.map((e) => [e.x, 0.5, e.z]);
    if (!impacts.length) {
      const [hx, hz] = castRay(x, z, yaw, solid);
      const d = Math.min(Math.hypot(hx - x, hz - z), cfg.cone ? 2.5 : AIM_RANGE);
      impacts = [[x + fx * d, 0.5, z + fz * d]];
    }
    impacts.forEach((at) => fxRef.current?.spawn(cfg.fx, muzzle, at));
    hits.forEach(neutralize);
  };
  fireRef.current = fire;
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
    if (!game || !started || openPanel || talk || performance.now() - wheelAt.current < 200) return;
    wheelAt.current = performance.now();
    switchWeapon(weapon + (e.deltaY > 0 ? 1 : -1));
  };
  const closePanel = () => {
    setOpenPanel(null);
    if (read.length === panelList.length && !allReadAnnounced.current) {
      allReadAnnounced.current = true;
      announce(t('demos.game.allRead'));
    } else {
      announce(t('demos.game.status.walls', { count: read.length, total: panelList.length }));
    }
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
    import('./sfx').then(({ createSfx }) => {
      // The player may have muted again, or left, while the chunk loaded
      if (!soundRef.current || !wrapperRef.current) return;
      sfx.current ??= createSfx(volumeRef.current);
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
    try {
      localStorage.setItem(VOLUME_KEY, String(value));
    } catch {
      // Not remembered: fine
    }
  };
  const toggleContrast = () => {
    const next = !flat;
    setContrast(next);
    announce(t(next ? 'demos.game.contrastOn' : 'demos.game.contrastOff'));
    invalidateRef.current();
    try {
      localStorage.setItem(CONTRAST_KEY, next ? '1' : '0');
    } catch {
      // Not remembered: fine
    }
  };
  useEffect(() => {
    // Back from a demo or the text-only mode with sound on: the synthesizer comes back with it
    if (soundRef.current) {
      import('./sfx').then(({ createSfx }) => {
        if (!wrapperRef.current) return;
        sfx.current ??= createSfx(volumeRef.current);
        if (game) sfx.current.hum(true);
      });
    }
    if (initialState) wrapperRef.current?.focus({ preventScroll: true });
    return () => {
      sfx.current?.close();
      sfx.current = null;
    };
    // Once
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const control = e.target.closest('button, a, summary, details, [role=dialog]');
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
    input.looked = true;
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
    if (value) wrapperRef.current?.focus({ preventScroll: true });
  }, []);

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
      gl.domElement.setAttribute('aria-label', t('demos.cub3d.canvasLabel'));
      // Demand mode: a restored context stays blank until something asks for a frame
      gl.domElement.addEventListener('webglcontextrestored', () => invalidate());
    },
    [t]
  );

  // Game Mode draws every frame while playing (the threats and the weapon move); paused (the
  // menu, a dialog, Access granted), or with reduced motion (nothing moves on its own), on demand
  const playing = game && started && !openPanel && !access && !talk && !reduced;

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
      className='group relative h-full w-full touch-none overflow-hidden bg-background outline-none'
    >
      <Canvas
        frameloop={playing ? 'always' : 'demand'}
        // Full screen in Game Mode: a lower pixel ratio and no MSAA (the textures are pixel art)
        dpr={game ? (lowRes ? LOW_DPR : GAME_DPR) : DEMO_DPR}
        gl={game ? GAME_GL : DEMO_GL}
        // Game Mode: the flashlight's shadows, and tone mapping left to the post-processing (or
        // none at all in high contrast)
        shadows={game}
        flat={game}
        camera={CAMERA}
        onCreated={onCreated}
      >
        <Scene
          input={input}
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
        />
        {game && (
          <GameLayer
            enemies={enemies}
            npcs={npcs}
            labels={threatLabels}
            icons={techIcons}
            solid={solid}
            reduced={reduced}
            flat={flat}
            paused={paused}
            pressure={pressure}
            fxRef={fxRef}
            crosshairRef={crosshairRef}
            motion={motion}
            onTick={onTick}
          />
        )}
        {game && <DoorLabel label={doorLabel} />}
        {/* Watches the frame rate only while it runs every frame; a lasting dip lowers the
            resolution for the rest of the session */}
        {playing && !flat && (
          <PerformanceMonitor flipflops={3} onDecline={lowerRes} onFallback={lowerRes} />
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
          <p className='mt-1 flex justify-end gap-3 rounded-md bg-background px-2 py-0.5 text-xs text-foreground'>
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
          <summary className={`cursor-pointer rounded font-semibold ${styles.hudFocus}`}>
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
        <button
          type='button'
          onClick={lookWithMouse}
          className={`absolute right-3 z-30 inline-flex ${game ? 'bottom-24' : 'bottom-3'} h-11 items-center rounded-xl border border-line-strong bg-glass px-4 text-sm font-semibold text-foreground backdrop-blur-md hover:border-foreground-muted ${styles.hudFocus}`}
        >
          {t('demos.cub3d.mouseLook')}
        </button>
      )}

      {touch && started && (
        <div
          className={`absolute right-3 z-30 grid grid-cols-3 gap-1.5 ${game ? 'bottom-12' : 'bottom-16'}`}
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
          onTextMode={() => onTextMode(snapshot())}
          onExit={onExit}
          contrast={flat}
          onContrast={toggleContrast}
          volume={volume}
          onVolume={changeVolume}
        />
      )}
      {!started && !game && (
        // Scrolls on short or zoomed screens, so Start is always reachable
        <div className='absolute inset-0 z-40 flex overflow-y-auto bg-background/70 p-4 backdrop-blur-sm'>
          <div className='m-auto w-full max-w-lg rounded-3xl border border-line bg-glass-strong p-6 shadow-xl'>
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

      {game && (
        <GameHud
          t={t}
          aim={target && aimText(t, enemies.current, target)}
          read={read.length}
          total={panelList.length}
          kills={kills}
          threats={ENEMIES.length}
          room={room}
          weapon={weapon}
          toast={toast}
          access={access}
          sound={sound}
          onSound={toggleSound}
          onTextMode={() => onTextMode(snapshot())}
          onExit={onExit}
          crosshairRef={crosshairRef}
          energyBar={energyBar}
          integrityBar={integrityBar}
          hitRef={hitRef}
          contrast={flat}
          onContrast={toggleContrast}
          volume={volume}
          onVolume={changeVolume}
        />
      )}
      {talk && (
        <NpcDialogue
          t={t}
          name={t(`demos.game.npcs.${talk}.name`)}
          line={t(`demos.game.npcs.${talk}.line`)}
          reduced={reduced}
          onClose={closeTalk}
        />
      )}
      {openPanel && (
        <GameInfo
          t={t}
          title={panelTitle(t, openPanel)}
          detail={details[openPanel]}
          onClose={closePanel}
        >
          {KIND[openPanel] === 'contact' && <ContactForm />}
        </GameInfo>
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
