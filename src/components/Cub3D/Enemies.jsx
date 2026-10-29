import { Suspense, memo, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  MathUtils,
  NearestFilter,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  SpriteMaterial,
} from 'three';

import { readTheme, rgb } from '../../utils/themeColors';
import { ICON_Y, iconSpot } from './rooms';

// Game Mode's layer inside the Canvas: the threats (one THREE.Sprite each, drifting toward the
// player once in sight), the crew (NPC sprites), the weapons' particle effects, the Skills
// hall's floating tech icons, and the per-frame weapon motion (bob, sway, recoil) and screen
// shake. The shared state lives in refs owned by Cub3DWorld, so a shot never re-renders this tree.

const SIGHT = 8; // cells: threats this close, and in line of sight, come for the player
const SPEED = 0.6; // cells per second
const STOP = 1.2; // cells: they hover this far away
const BODY = 0.2; // collision radius, as the player's
const FX_LIFE = 0.5; // seconds: every particle effect is freed after this
// Each threat's theme color: DDoS in danger red, injection in violet
const THREAT_COLORS = { ddos: 'danger', sql: 'secondary' };
// The effects' colors: the rifle's blue trail, the pistol's green blocks, the blaster's orange
const FX_COLORS = { trail: 'info', blocks: 'success', radial: 'primary' };

// Pixel art, 16x16: 'o' outline, 'X' body in the sprite's color, 'e' eyes, 'h' head
const BUG = [
  '....o......o....',
  '.....o....o.....',
  '....oooooooo....',
  '...oXXXXXXXXo...',
  '..oXXeeXXeeXXo..',
  '..oXXeeXXeeXXo..',
  'o.oXXXXXXXXXXo.o',
  '.ooXXXXXXXXXXoo.',
  '..oXXXXXXXXXXo..',
  '.ooXXXXXXXXXXoo.',
  'o.oXXXXXXXXXXo.o',
  '..oXXXXXXXXXXo..',
  '...oXXXXXXXXo...',
  '..o.oooooooo.o..',
  '.o............o.',
  '................',
];
const PERSON = [
  '.....oooooo.....',
  '....ohhhhhho....',
  '....ohehhheo....',
  '....ohhhhhho....',
  '.....ohhhho.....',
  '...ooXXXXXXoo...',
  '..oXXXXXXXXXXo..',
  '..oXoXXXXXXoXo..',
  '..oXoXXXXXXoXo..',
  '..oXoXXXXXXoXo..',
  '...o.XXXXXX.o...',
  '....oXXooXXo....',
  '....oXXo.oXXo...',
  '....oXXo.oXXo...',
  '....ooo...ooo...',
  '................',
];

// A sprite texture: the pixel art over its label, in theme colors
const makeTexture = (art, colors, color, label) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const fills = {
    o: colors.background,
    X: colors[color],
    e: colors.background,
    h: colors.foreground,
  };
  art.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return;
      ctx.fillStyle = rgb(art === BUG && c === 'e' ? colors.foreground : fills[c]);
      ctx.fillRect(x * 8, y * 8, 8, 8);
    })
  );
  ctx.fillStyle = rgb(colors.background, 0.85);
  ctx.fillRect(0, 128, 128, 32);
  ctx.fillStyle = rgb(colors.foreground);
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 64, 145, 124);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
};

// three's Color parses 'rgb(r,g,b)', not the 'R G B' channels the tokens hold
const threeColor = (channels) => `rgb(${channels.split(' ').join(',')})`;

// The particles of one effect: start positions and velocities (cells, cells per second)
const PARTICLES = {
  // A line of particles from the muzzle to the target, drifting apart
  trail: (from, to) =>
    Array.from({ length: 28 }, (_, i) => {
      const f = i / 27;
      return [
        from[0] + (to[0] - from[0]) * f,
        from[1] + (to[1] - from[1]) * f,
        from[2] + (to[2] - from[2]) * f,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
      ];
    }),
  // Square blocks thrown out and falling where the shot lands
  blocks: (from, to) =>
    Array.from({ length: 14 }, () => [
      to[0],
      to[1],
      to[2],
      (Math.random() - 0.5) * 1.6,
      Math.random() * 1.6,
      (Math.random() - 0.5) * 1.6,
    ]),
  // A ring flying out flat from the impact
  radial: (from, to) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2;
      return [
        to[0],
        to[1],
        to[2],
        Math.cos(a) * 2.2,
        (Math.random() - 0.5) * 0.6,
        Math.sin(a) * 2.2,
      ];
    }),
};
const FX_SIZE = { trail: 0.035, blocks: 0.08, radial: 0.06 };

/**
 * The weapons' particle effects. `fxRef.current.spawn(kind, from, to)` makes one (THREE.Points)
 * that lives FX_LIFE seconds and is then disposed. The particle shader is compiled up front on a
 * hidden copy, so the first shot does not stall
 */
const Effects = ({ reduced, fxRef }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const live = useRef([]);
  const colors = useMemo(() => {
    const c = readTheme(Object.values(FX_COLORS));
    return Object.fromEntries(Object.entries(FX_COLORS).map(([k, v]) => [k, threeColor(c[v])]));
  }, []);

  const make = (kind, particles) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(particles.flatMap((p) => p.slice(0, 3))), 3)
    );
    const points = new Points(
      geometry,
      new PointsMaterial({
        color: colors[kind],
        size: FX_SIZE[kind],
        transparent: true,
        depthWrite: false,
      })
    );
    // Its particles fly out from one place: no bounding sphere to cull by
    points.frustumCulled = false;
    return points;
  };
  const free = (points) => {
    scene.remove(points);
    points.geometry.dispose();
    points.material.dispose();
  };

  useEffect(() => {
    // The program every effect uses, compiled now on a hidden copy kept until unmount
    const warm = make('radial', PARTICLES.radial([0, 0, 0], [0, -10, 0]));
    warm.visible = false;
    scene.add(warm);
    gl.compile(scene, camera);
    fxRef.current = {
      spawn: (kind, from, to) => {
        // Reduced motion: no flying particles
        if (reduced) return;
        const particles = PARTICLES[kind](from, to);
        const points = make(kind, particles);
        scene.add(points);
        live.current.push({
          points,
          velocities: new Float32Array(particles.flatMap((p) => p.slice(3))),
          gravity: kind === 'blocks' ? 3 : 0,
          age: 0,
        });
      },
    };
    const effects = live.current;
    return () => {
      fxRef.current = null;
      free(warm);
      effects.forEach(({ points }) => free(points));
      effects.length = 0;
    };
    // The effects' colors are read once; the scene, renderer and camera are the Canvas's own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxRef, reduced, scene, gl, camera]);

  useFrame((state, delta) => {
    const effects = live.current;
    if (!effects.length) return;
    const dt = Math.min(delta, 0.1);
    // In place: freed once FX_LIFE is up
    let kept = 0;
    effects.forEach((fx) => {
      fx.age += dt;
      if (fx.age >= FX_LIFE) {
        free(fx.points);
        return;
      }
      const pos = fx.points.geometry.attributes.position;
      const v = fx.velocities;
      for (let i = 0; i < pos.count; i += 1) {
        v[i * 3 + 1] -= fx.gravity * dt;
        pos.array[i * 3] += v[i * 3] * dt;
        pos.array[i * 3 + 1] += v[i * 3 + 1] * dt;
        pos.array[i * 3 + 2] += v[i * 3 + 2] * dt;
      }
      pos.needsUpdate = true;
      fx.points.material.opacity = 1 - fx.age / FX_LIFE;
      effects[kept] = fx;
      kept += 1;
    });
    effects.length = kept;
  }, -1);
  return null;
};

/**
 * The threats and the crew. Threats drift toward the player once in sight, unless `paused` (a
 * dialogue is open) or motion is reduced; the crew stand where rooms.js puts them
 */
const Sprites = ({ enemies, npcs, labels, solid, reduced, paused }) => {
  const time = useRef(0);

  // GPU resources made here, so freed here (they are not R3F's). One material per threat type,
  // shared by every threat of that type
  const materials = useMemo(() => {
    const colors = readTheme([
      'background',
      'foreground',
      ...new Set([...Object.values(THREAT_COLORS), ...npcs.current.map((n) => n.color)]),
    ]);
    const made = {};
    Object.entries(THREAT_COLORS).forEach(([type, color]) => {
      made[type] = new SpriteMaterial({ map: makeTexture(BUG, colors, color, labels[type]) });
    });
    npcs.current.forEach(({ id, color }) => {
      made[id] = new SpriteMaterial({ map: makeTexture(PERSON, colors, color, labels[id]) });
    });
    return made;
    // The crew are fixed (rooms.js); labels change with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels]);
  useEffect(
    () => () =>
      Object.values(materials).forEach((m) => {
        m.map.dispose();
        m.dispose();
      }),
    [materials]
  );

  const blocked = (x, z) => solid(Math.floor(x), Math.floor(z));
  const free = (x, z) =>
    !blocked(x - BODY, z - BODY) &&
    !blocked(x + BODY, z - BODY) &&
    !blocked(x - BODY, z + BODY) &&
    !blocked(x + BODY, z + BODY);
  const inSight = (x, z, tx, tz) => {
    const steps = Math.ceil(Math.hypot(tx - x, tz - z) / 0.1);
    for (let i = 1; i < steps; i += 1) {
      if (blocked(x + ((tx - x) * i) / steps, z + ((tz - z) * i) / steps)) return false;
    }
    return true;
  };

  useFrame((state, delta) => {
    if (paused.current) return;
    const dt = Math.min(delta, 0.1);
    const { x: px, z: pz } = state.camera.position;
    // Its own clock: R3F's restarts at 0 whenever the frame loop mode changes
    time.current += dt;
    enemies.current.forEach((enemy, i) => {
      const { sprite } = enemy;
      if (!sprite || !enemy.alive) return;
      if (!reduced) {
        const d = Math.hypot(px - enemy.x, pz - enemy.z);
        if (d < SIGHT && d > STOP && inSight(enemy.x, enemy.z, px, pz)) {
          const step = (SPEED * dt) / d;
          const nx = enemy.x + (px - enemy.x) * step;
          const nz = enemy.z + (pz - enemy.z) * step;
          if (free(nx, enemy.z)) enemy.x = nx;
          if (free(enemy.x, nz)) enemy.z = nz;
        }
      }
      // A slow float, unless motion is reduced
      const y = reduced ? 0.5 : 0.5 + Math.sin(time.current * 2 + i) * 0.05;
      sprite.position.set(enemy.x, y, enemy.z);
    });
  }, -1);

  return (
    <>
      {enemies.current.map((enemy) => (
        <sprite
          key={enemy.id}
          // An enemy's `sprite` lets a kill hide it without a render
          ref={(el) => {
            enemy.sprite = el;
          }}
          material={materials[enemy.type]}
          position={[enemy.x, 0.5, enemy.z]}
          scale={[0.5, 0.625, 1]}
          visible={enemy.alive}
        />
      ))}
      {npcs.current.map((npc) => (
        <sprite
          key={npc.id}
          material={materials[npc.id]}
          position={[npc.x, 0.42, npc.z]}
          scale={[0.55, 0.69, 1]}
        />
      ))}
    </>
  );
};

/** The Skills hall's tech icons, floating; they load on their own, after the world */
const TechIcons = ({ icons, reduced }) => {
  const textures = useTexture(icons);
  const refs = useRef([]);
  const time = useRef(0);
  useFrame((state, delta) => {
    if (reduced) return;
    time.current += Math.min(delta, 0.1);
    refs.current.forEach((sprite, i) => {
      if (sprite) sprite.position.y = ICON_Y + Math.sin(time.current * 1.5 + i) * 0.06;
    });
  });
  // drei caches the textures (never disposed here); R3F frees the sprite materials it made
  return textures.map((texture, i) => (
    <sprite
      key={icons[i]}
      ref={(el) => {
        refs.current[i] = el;
      }}
      position={iconSpot(i)}
      scale={0.34}
    >
      <spriteMaterial map={texture} />
    </sprite>
  ));
};

/**
 * Per frame: the weapon's bob (from the distance walked), sway (behind the turning) and recoil,
 * written as one transform, plus a short screen shake after a shot. `motion` is shared with
 * Cub3DWorld: a shot sets `recoil` and `shake` (each weapon its own amount). Then
 * `onTick(camera, dt)`: the aim, the radar and automatic fire
 */
const GameMotion = ({ weaponRef, motion, reduced, onTick }) => {
  // Seeded from the camera on the first frame, so the start (or a return) is not a jolt
  const last = useRef(null);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const { camera } = state;
    const m = motion.current;
    const l = (last.current ??= {
      x: camera.position.x,
      z: camera.position.z,
      yaw: camera.rotation.y,
      phase: 0,
      amp: 0,
      sway: 0,
      moving: '',
      transform: null,
    });
    const walked = Math.hypot(camera.position.x - l.x, camera.position.z - l.z);
    // The shortest way round: mouse look keeps the yaw in [-PI, PI], keys do not
    const turned =
      MathUtils.euclideanModulo(camera.rotation.y - l.yaw + Math.PI, 2 * Math.PI) - Math.PI;
    l.x = camera.position.x;
    l.z = camera.position.z;
    l.yaw = camera.rotation.y;
    m.recoil = MathUtils.damp(m.recoil, 0, 14, dt);
    m.shake = MathUtils.damp(m.shake, 0, 20, dt);
    const el = weaponRef.current;
    if (el) {
      const moving = String(walked > 0);
      if (l.moving !== moving) el.dataset.moving = l.moving = moving;
      let transform = '';
      if (!reduced) {
        const rate = dt > 0 ? turned / dt : 0;
        l.phase += walked * 4;
        l.amp = MathUtils.damp(l.amp, walked > 0 ? 1 : 0, 10, dt);
        l.sway = MathUtils.damp(l.sway, MathUtils.clamp(rate * 10, -28, 28), 8, dt);
        const x = Math.sin(l.phase) * 7 * l.amp + l.sway;
        const y = Math.abs(Math.cos(l.phase)) * 6 * l.amp - m.recoil * 22;
        transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(-m.recoil * 6).toFixed(1)}deg)`;
      }
      // Written only when it changes
      if (l.transform !== transform) el.style.transform = l.transform = transform;
    }
    // The pitch is pinned to the horizon otherwise: a shake is a few frames of jitter
    if (!reduced && m.shake > 0.01) {
      camera.rotation.x = (Math.random() - 0.5) * 0.03 * m.shake;
      camera.rotation.z = (Math.random() - 0.5) * 0.02 * m.shake;
    } else if (camera.rotation.x || camera.rotation.z) {
      camera.rotation.x = 0;
      camera.rotation.z = 0;
    }
    onTick(camera, dt);
  }, -1);
  return null;
};

/**
 * Everything above, as one memoized layer: its props are all stable (refs and memoized values),
 * so HUD state in Cub3DWorld (the aim, the toast) never re-renders the 3D tree
 */
export const GameLayer = memo(function GameLayer({
  enemies,
  npcs,
  labels,
  icons,
  solid,
  reduced,
  paused,
  fxRef,
  weaponRef,
  motion,
  onTick,
}) {
  return (
    <>
      <Sprites
        enemies={enemies}
        npcs={npcs}
        labels={labels}
        solid={solid}
        reduced={reduced}
        paused={paused}
      />
      <Effects reduced={reduced} fxRef={fxRef} />
      {icons && (
        <Suspense fallback={null}>
          <TechIcons icons={icons} reduced={reduced} />
        </Suspense>
      )}
      <GameMotion weaponRef={weaponRef} motion={motion} reduced={reduced} onTick={onTick} />
    </>
  );
});
