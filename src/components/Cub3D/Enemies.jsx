import { Suspense, memo, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import {
  AdditiveBlending,
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
// player once in sight), their explosions, the Skills hall's floating tech icons, and the
// per-frame weapon motion (bob, sway, recoil) and screen shake. The shared state lives in refs
// owned by Cub3DWorld, so a kill or a shot never re-renders this tree.

const SIGHT = 8; // cells: threats this close, and in line of sight, come for the player
const SPEED = 0.6; // cells per second
const STOP = 1.2; // cells: they hover this far away
const BODY = 0.2; // collision radius, as the player's
const BURST = 24; // particles per explosion
const BURST_LIFE = 0.6; // seconds
// Each threat's theme color: DDoS in danger red, injection in violet
const THREAT_COLORS = { ddos: 'danger', sql: 'secondary' };

// A pixel-art bug, 16x16 ('o' outline, 'X' body in the threat's color, 'e' eyes)
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

// The sprite: the bug over its label, in theme colors
const makeThreatTexture = (colors, color, label) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  BUG.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return;
      ctx.fillStyle = rgb({ o: colors.background, X: colors[color], e: colors.foreground }[c]);
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

/**
 * The threats and their explosions. `fxRef.current.burst(enemy)` blows one up, with one pooled
 * particle burst per threat (made, and compiled, up front: no allocation or shader compile at
 * the moment of the shot)
 */
const Threats = ({ enemies, labels, solid, reduced, fxRef }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const time = useRef(0);

  // GPU resources made here, so freed here (they are not R3F's)
  const resources = useMemo(() => {
    const colors = readTheme(['background', 'foreground', ...Object.values(THREAT_COLORS)]);
    const materials = Object.fromEntries(
      Object.entries(THREAT_COLORS).map(([type, color]) => [
        type,
        new SpriteMaterial({ map: makeThreatTexture(colors, color, labels[type]) }),
      ])
    );
    const pool = enemies.current.map(({ type }) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(BURST * 3), 3));
      const points = new Points(
        geometry,
        new PointsMaterial({
          color: threeColor(colors[THREAT_COLORS[type]]),
          size: 0.07,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        })
      );
      points.visible = false;
      // Its particles fly out from one point: no bounding sphere to cull by
      points.frustumCulled = false;
      return { points, velocities: new Float32Array(BURST * 3), age: BURST_LIFE };
    });
    return { materials, pool };
    // The threats are fixed (rooms.js); labels change with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels]);

  useEffect(() => {
    const { materials, pool } = resources;
    pool.forEach(({ points }) => scene.add(points));
    // Compile every program now (three compiles invisible objects too), not on the first kill
    gl.compile(scene, camera);
    return () => {
      Object.values(materials).forEach((m) => {
        m.map.dispose();
        m.dispose();
      });
      pool.forEach(({ points }) => {
        scene.remove(points);
        points.geometry.dispose();
        points.material.dispose();
      });
    };
  }, [resources, scene, gl, camera]);

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

  useEffect(() => {
    fxRef.current = {
      burst: (enemy) => {
        // Reduced motion: the threat just goes, with no flying particles
        if (reduced) return;
        const burst = resources.pool[enemies.current.indexOf(enemy)];
        if (!burst) return;
        const pos = burst.points.geometry.attributes.position;
        for (let i = 0; i < BURST; i += 1) {
          pos.setXYZ(i, enemy.x, 0.5, enemy.z);
          const a = (i / BURST) * Math.PI * 2;
          burst.velocities.set([Math.cos(a) * 1.2, Math.random() * 1.4, Math.sin(a) * 1.2], i * 3);
        }
        pos.needsUpdate = true;
        burst.age = 0;
        burst.points.visible = true;
      },
    };
    return () => {
      fxRef.current = null;
    };
  }, [fxRef, resources, reduced, enemies]);

  useFrame((state, delta) => {
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
    // Explosions: particles fly out, fall and fade
    resources.pool.forEach((burst) => {
      if (burst.age >= BURST_LIFE) return;
      burst.age += dt;
      if (burst.age >= BURST_LIFE) {
        burst.points.visible = false;
        return;
      }
      const pos = burst.points.geometry.attributes.position;
      const v = burst.velocities;
      for (let i = 0; i < BURST; i += 1) {
        v[i * 3 + 1] -= 2.5 * dt;
        pos.array[i * 3] += v[i * 3] * dt;
        pos.array[i * 3 + 1] += v[i * 3 + 1] * dt;
        pos.array[i * 3 + 2] += v[i * 3 + 2] * dt;
      }
      pos.needsUpdate = true;
      burst.points.material.opacity = 1 - burst.age / BURST_LIFE;
    });
  }, -1);

  return enemies.current.map((enemy) => (
    <sprite
      key={enemy.id}
      // An enemy's `sprite` lets a kill hide it without a render
      ref={(el) => {
        enemy.sprite = el;
      }}
      material={resources.materials[enemy.type]}
      position={[enemy.x, 0.5, enemy.z]}
      scale={[0.5, 0.625, 1]}
      visible={enemy.alive}
    />
  ));
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
 * Cub3DWorld: it sets `recoil` and `shake` to 1 on a shot. Then `onTick` (the aim)
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
    onTick(camera);
  }, -1);
  return null;
};

/**
 * Everything above, as one memoized layer: its props are all stable (refs and memoized values),
 * so HUD state in Cub3DWorld (the aim, the toast) never re-renders the 3D tree
 */
export const GameLayer = memo(function GameLayer({
  enemies,
  labels,
  icons,
  solid,
  reduced,
  fxRef,
  weaponRef,
  motion,
  onTick,
}) {
  return (
    <>
      <Threats enemies={enemies} labels={labels} solid={solid} reduced={reduced} fxRef={fxRef} />
      {icons && (
        <Suspense fallback={null}>
          <TechIcons icons={icons} reduced={reduced} />
        </Suspense>
      )}
      <GameMotion weaponRef={weaponRef} motion={motion} reduced={reduced} onTick={onTick} />
    </>
  );
});
