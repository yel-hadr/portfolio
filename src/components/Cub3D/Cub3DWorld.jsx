import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PointerLockControls } from '@react-three/drei';
import {
  BoxGeometry,
  CanvasTexture,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  SRGBColorSpace,
} from 'three';

import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { styles } from '../../styles';
import { readTheme, rgb } from '../../utils/themeColors';
import ReleaseContext from '../canvas/ReleaseContext';
import { MAP_CUB, parseCub } from './map';

// A web homage to cub3D: the project's own map.cub as a first-person maze. The original casts
// one ray per screen column; here three.js draws the walls as boxes, and the minimap shows the
// rays, stepping from grid line to grid line as the original does.

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

// Every door starts closed: { [cell]: true while closed }
const DOORS_CLOSED = Object.fromEntries(DOOR_CELLS.map((cell) => [cell, true]));

// The panels on the walls of the large north-east room (map rows 1-4): position just off a wall
// face, and the yaw that faces the room
const PANELS = [
  { id: 'welcome', position: [26.5, 0.55, 1.02], yaw: 0 },
  { id: 'about', position: [22.5, 0.55, 1.02], yaw: 0 },
  { id: 'skills', position: [31.98, 0.55, 2.5], yaw: -Math.PI / 2 },
  { id: 'projects', position: [23.5, 0.55, 4.98], yaw: Math.PI },
];
const PANEL_STEP = 0.1; // line-of-sight sampling, in cells

/** The world inside the Canvas: walls, door, floor and ceiling, movement and the panels */
const Scene = ({
  input,
  solid,
  closedDoors,
  panels,
  onMove,
  lockable,
  lockRef,
  onLockChange,
  reduced,
}) => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const walls = useRef(null);
  const panelEls = useRef([]);
  const moving = useRef(false);
  const shell = useMemo(shellCells, []);

  // GPU resources made here are not owned by R3F (they are passed as args), so they are freed
  // on unmount below
  const resources = useMemo(() => {
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
    return { tex, wallMaterials, door, box };
  }, []);

  useEffect(
    () => () => {
      const { tex, wallMaterials, door, box } = resources;
      Object.values(tex).forEach((t) => t.dispose());
      new Set([...wallMaterials, door]).forEach((m) => m.dispose());
      box.dispose();
    },
    [resources]
  );

  useLayoutEffect(() => {
    const dummy = new Object3D();
    shell.forEach(({ x, z }, i) => {
      dummy.position.set(x + 0.5, 0.5, z + 0.5);
      dummy.updateMatrix();
      walls.current.setMatrixAt(i, dummy.matrix);
    });
    walls.current.instanceMatrix.needsUpdate = true;
    walls.current.computeBoundingSphere();
  }, [shell]);

  // The player starts where map.cub puts N, facing north
  useLayoutEffect(() => {
    camera.rotation.order = 'YXZ';
    camera.position.set(WORLD.player.x, EYE, WORLD.player.z);
    camera.rotation.set(0, WORLD.player.yaw, 0);
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
  const free = (x, z) =>
    !blocked(x - RADIUS, z - RADIUS) &&
    !blocked(x + RADIUS, z - RADIUS) &&
    !blocked(x - RADIUS, z + RADIUS) &&
    !blocked(x + RADIUS, z + RADIUS);

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
  useFrame(() => {
    panels.forEach(({ position }, i) => {
      const el = panelEls.current[i];
      if (el) el.style.visibility = inSight(position[0], position[2]) ? '' : 'hidden';
    });
  });

  // Held keys move the player; demand mode renders only while something moves
  useFrame((state, delta) => {
    const held = input.current;
    if (!held.size && !input.looked) {
      moving.current = false;
      return;
    }
    // In demand mode the first frame's delta spans the whole pause before it: one step instead
    const dt = moving.current ? Math.min(delta, 0.1) : 1 / 60;
    moving.current = true;
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
    if (turn && !reduced) camera.rotation.y += turn * TURN_SPEED * dt;
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
  });

  // Stable handlers: drei re-subscribes the controls whenever they change
  const onLook = useCallback(() => {
    input.looked = true;
  }, [input]);
  const onLock = useCallback(() => onLockChange(true), [onLockChange]);
  const onUnlock = useCallback(() => onLockChange(false), [onLockChange]);

  return (
    <>
      <instancedMesh ref={walls} args={[resources.box, resources.wallMaterials, shell.length]} />
      {DOOR_CELLS.map((cell) => (
        <mesh
          key={cell}
          position={[(cell % W) + 0.5, 0.5, Math.floor(cell / W) + 0.5]}
          geometry={resources.box}
          material={resources.door}
          visible={closedDoors[cell]}
        />
      ))}
      {/* Flat floor and ceiling colors, the F and C lines of map.cub */}
      <mesh position={[W / 2, 0, H / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 2, H + 2]} />
        <meshBasicMaterial color={`rgb(${WORLD.floor.join(',')})`} />
      </mesh>
      <mesh position={[W / 2, 1, H / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 2, H + 2]} />
        <meshBasicMaterial color={`rgb(${WORLD.ceiling.join(',')})`} />
      </mesh>
      {panels.map(({ id, position, yaw, title, lines }, i) => (
        <Html
          key={id}
          ref={(el) => {
            panelEls.current[i] = el;
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
};

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

/** The cub3D demo: the canvas, minimap, HUD, welcome card and touch controls */
const Cub3DWorld = ({ t, technologies, projects }) => {
  const touch = useMediaQuery('(pointer: coarse)');
  const reduced = usePrefersReducedMotion();
  const lockable = !touch && 'exitPointerLock' in document;
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('');
  const wrapperRef = useRef(null);
  const minimapRef = useRef(null);
  const staticLayer = useRef(null);
  const lockRef = useRef(null);
  const input = useRef(new Set());
  // Door state: React state to draw the door meshes, mirrored in a ref for the movement loop
  const [closedDoors, setClosedDoors] = useState(DOORS_CLOSED);
  const doors = useRef(DOORS_CLOSED);
  const heading = useRef('north');
  const invalidateRef = useRef(() => {});
  const cameraRef = useRef(null);
  const helpId = useId();

  // Walls, closed doors and anything outside the enclosed area block the way
  const solid = useCallback(
    (cx, cz) => !isFloor(cx, cz) || doors.current[cz * W + cx] === true,
    []
  );

  const panels = useMemo(
    () =>
      PANELS.map((panel) => {
        const lines = {
          welcome: [t('demos.cub3d.panels.welcomeBody')],
          about: [t('person.title')],
          skills: [technologies.join(' · ')],
          projects: [projects.join(' · ')],
        }[panel.id];
        return { ...panel, title: t(`demos.cub3d.panels.${panel.id}`), lines };
      }),
    [t, technologies, projects]
  );

  // Read once: the page (and its theme toggle) is inert while the demo is open
  const colors = useMemo(() => {
    const c = readTheme(['foreground', 'background', 'primary', 'danger', 'success']);
    return {
      back: rgb(c.background, 0.85),
      wall: rgb(c.foreground, 0.75),
      closed: rgb(c.danger),
      open: rgb(c.success),
      ray: rgb(c.primary, 0.55),
      player: rgb(c.primary),
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
    DOOR_CELLS.forEach((i) => {
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
  }, [colors]);

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

  // Re-announces a message even when it is the same as the last one
  const announce = useCallback((text) => {
    setMessage('');
    requestAnimationFrame(() => setMessage(text));
  }, []);
  const facingTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(facingTimer.current), []);

  // Called after every move: redraw the minimap; a new heading is announced once turning has
  // settled, not at every 45° crossed on the way
  const onMove = useCallback(
    (camera) => {
      cameraRef.current = camera;
      drawMinimap(camera);
      const next = headingOf(camera.rotation.y);
      if (next === heading.current) return;
      heading.current = next;
      window.clearTimeout(facingTimer.current);
      facingTimer.current = window.setTimeout(() => {
        announce(t('demos.cub3d.sr.facing', { direction: t(`demos.cub3d.directions.${next}`) }));
      }, 500);
    },
    [drawMinimap, announce, t]
  );

  // Space opens or closes a door about half a cell ahead, as in the original
  const toggleDoor = () => {
    const camera = cameraRef.current;
    if (!camera) return;
    const yaw = camera.rotation.y;
    const ax = Math.floor(camera.position.x - Math.sin(yaw) * 0.8);
    const az = Math.floor(camera.position.z - Math.cos(yaw) * 0.8);
    const ahead = az * W + ax;
    const here = Math.floor(camera.position.z) * W + Math.floor(camera.position.x);
    if (!(ahead in doors.current) || ahead === here) {
      announce(t('demos.cub3d.sr.noDoor'));
      return;
    }
    const closed = !doors.current[ahead];
    doors.current = { ...doors.current, [ahead]: closed };
    setClosedDoors(doors.current);
    announce(t(closed ? 'demos.cub3d.sr.doorClosed' : 'demos.cub3d.sr.doorOpened'));
    paintStatic();
    drawMinimap(camera);
    invalidateRef.current();
  };

  const press = (code) => {
    input.current.add(code);
    invalidateRef.current();
  };
  const release = (code) => input.current.delete(code);

  // Keys act only while the view itself has focus: a focused button keeps Space, and nothing
  // moves behind the welcome card. Escape is left to the dialog (it closes the demo); while the
  // mouse is captured, the browser takes the first Escape to release it
  const onKeyDown = (e) => {
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
    }
  };
  const onKeyUp = (e) => release(e.code);

  // Touch: dragging on the view turns (there is no pointer lock on touch screens)
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' || e.target.closest('button, summary, details')) return;
    drag.current = e.clientX;
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
    lockRef.current?.lock();
  };
  const onLockChange = useCallback((value) => {
    setLocked(value);
    if (value) wrapperRef.current?.focus({ preventScroll: true });
  }, []);

  // Releasing keys when focus leaves keeps the player from walking on alone
  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) input.current.clear();
  };
  useEffect(() => {
    const keys = input.current;
    const clear = () => keys.clear();
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

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      role='application'
      aria-label={t('demos.cub3d.appLabel')}
      aria-describedby={helpId}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className='group relative h-full w-full touch-none overflow-hidden bg-background outline-none'
    >
      <Canvas
        frameloop='demand'
        dpr={[1, 2]}
        gl={{ powerPreference: 'default' }}
        camera={{ fov: 50, near: 0.05, far: 60 }}
        onCreated={({ gl, invalidate }) => {
          invalidateRef.current = invalidate;
          gl.domElement.setAttribute('role', 'img');
          gl.domElement.setAttribute('aria-label', t('demos.cub3d.canvasLabel'));
          // Demand mode: a restored context stays blank until something asks for a frame
          gl.domElement.addEventListener('webglcontextrestored', () => invalidate());
        }}
      >
        <Scene
          input={input}
          solid={solid}
          closedDoors={closedDoors}
          panels={panels}
          onMove={onMove}
          lockable={lockable}
          lockRef={lockRef}
          onLockChange={onLockChange}
          reduced={reduced}
        />
      </Canvas>

      {/* HUD */}
      <canvas
        ref={minimapRef}
        aria-hidden='true'
        className='pointer-events-none absolute right-3 top-3 z-30 rounded-md border border-line-strong'
        style={{ width: W * MINIMAP_CELL, height: H * MINIMAP_CELL }}
      />
      <p
        id={helpId}
        className='absolute bottom-3 left-3 z-30 max-w-md rounded-xl bg-background/80 px-3 py-2 text-sm text-foreground-muted'
      >
        {/* The welcome card's key list, as a reminder */}
        {t(touch ? 'demos.cub3d.welcome.keysTouch' : 'demos.cub3d.welcome.keys').join(' · ')}
      </p>
      {lockable && started && !locked && (
        <button
          type='button'
          onClick={lookWithMouse}
          className={`absolute bottom-3 right-3 z-30 inline-flex h-11 items-center rounded-xl border border-line-strong bg-glass px-4 text-sm font-semibold text-foreground backdrop-blur-md hover:border-foreground-muted ${styles.hudFocus}`}
        >
          {t('demos.cub3d.mouseLook')}
        </button>
      )}

      {/* The wall panels' text, for anyone who cannot see or reach them in the maze */}
      {started && (
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

      {touch && started && (
        <div
          className='absolute bottom-16 right-3 z-30 grid grid-cols-3 gap-1.5'
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
            onClick={toggleDoor}
            className={`${TOUCH_BUTTON} col-start-2 row-start-3 w-auto px-2 text-xs`}
          >
            {t('demos.cub3d.touch.door')}
          </button>
        </div>
      )}

      {!started && (
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
              {t(touch ? 'demos.cub3d.welcome.keysTouch' : 'demos.cub3d.welcome.keys').map(
                (line) => (
                  <li key={line}>{line}</li>
                )
              )}
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

      <p role='status' className='sr-only'>
        {message}
      </p>
      {/* The focus ring, drawn above the opaque canvas */}
      <span aria-hidden='true' className={styles.viewFocusRing} />
    </div>
  );
};

export default Cub3DWorld;
