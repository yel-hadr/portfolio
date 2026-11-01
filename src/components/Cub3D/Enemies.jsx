import { Suspense, memo, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  SRGBColorSpace,
  SphereGeometry,
  SpriteMaterial,
  TetrahedronGeometry,
  TorusGeometry,
} from 'three';

import { useLiveRef } from '../../hooks/useLiveRef';
import { rgb } from '../../utils/themeColors';
import { readGameTheme } from './gameTheme';
import { frozen } from './freeze';
import { ENEMIES, ICON_Y, MOVE_SPEED, NPCS, PROP_BOXES, THREAT_TYPES, iconSpot } from './rooms';
import { toColor } from './toColor';

// Game Mode's layer inside the Canvas: the threats (low-poly "glitch" entities drifting toward
// the player once in sight, each leaving a faint trail, the nearest two lighting the walls in
// their color), the crew (holographic figures), the weapons' particle effects and a kill's voxel
// shatter, the Skills hall's floating tech icons, and the per-frame weapon motion (bob, sway,
// recoil) and screen shake. The shared state lives in refs owned by Cub3DWorld, so a shot never
// re-renders this tree.

// cells: threats this close, and in line of sight, come for the player. Short of the rifle's 14,
// but far enough that most are moving before a shot lands
const SIGHT = 11;
const STOP = 1.2; // cells: they hover this far away
const REACH = STOP + 0.35; // cells: this close, a threat wears down the player's integrity
const BODY = 0.2; // collision radius, as the player's
const FX_LIFE = 0.5; // seconds: every weapon particle effect is freed after this
const SHATTER_LIFE = 0.8;
const TRAIL = 14; // points per threat's trail
const TRAIL_LIFE = 0.9; // seconds a trail point takes to fade
const LIGHTS = 2; // threats lighting their surroundings at once (the nearest ones)
// Each threat type's theme color: DDoS in danger red, injection in toxic green, a memory leak in
// violet, a zero-day in the foreground's white (rooms.js)
const THREAT_COLORS = Object.fromEntries(
  Object.entries(THREAT_TYPES).map(([type, { color }]) => [type, color])
);
// A Memory Leak slows the player within SLOW_RANGE cells, down to SLOWEST of the walking speed
// at SLOW_FULL cells or closer
const SLOW_RANGE = 2.5;
const SLOW_FULL = 1.2;
const SLOWEST = 0.45;
// A Zero-Day shows only in the flashlight's beam: the spot's angle and range (Facility.jsx), its
// penumbra fading it in. The test is geometric, so it holds in high contrast (no lights) too
const BEAM_ANGLE = 0.46;
const BEAM_FULL = BEAM_ANGLE * (1 - 0.55);
const BEAM_RANGE = 9;
// The effects' colors: the rifle's blue trail, the pistol's green blocks, the blaster's orange
const FX_COLORS = { trail: 'info', blocks: 'success', radial: 'primary' };

// A name tag over a threat or a crew member, in theme colors
const labelTexture = (colors, color, label) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = rgb(colors.background, 0.85);
  ctx.fillRect(0, 8, 256, 48);
  ctx.fillStyle = rgb(colors[color]);
  ctx.fillRect(0, 8, 6, 48);
  ctx.fillStyle = rgb(colors.foreground);
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 131, 33, 236);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

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
const VOXELS = 30;
const VOXEL = new BoxGeometry(0.055, 0.055, 0.055);
const dummy = new Object3D();

// One effect's particles, in the effect's color
const makePoints = (colors, kind, particles) => {
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
const freePoints = (scene, points) => {
  scene.remove(points);
  points.geometry.dispose();
  points.material.dispose();
};
const freeShatter = (scene, mesh) => {
  scene.remove(mesh);
  mesh.material.dispose();
  mesh.dispose();
};

/**
 * The weapons' particle effects and a kill's shatter. `fxRef.current.spawn(kind, from, to)`
 * makes one effect (THREE.Points, freed after FX_LIFE); `fxRef.current.shatter(at, type)` bursts
 * a threat into glowing voxels (one InstancedMesh, freed after SHATTER_LIFE). The particle
 * shader is compiled up front on a hidden copy, so the first shot does not stall
 */
const Effects = ({ reduced, fxRef, hitStop }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const live = useRef([]);
  const shards = useRef([]);
  const colors = useMemo(() => {
    const c = readGameTheme([...Object.values(FX_COLORS), ...Object.values(THREAT_COLORS)]);
    return {
      ...Object.fromEntries(Object.entries(FX_COLORS).map(([k, v]) => [k, toColor(c[v])])),
      ...Object.fromEntries(Object.entries(THREAT_COLORS).map(([k, v]) => [k, toColor(c[v], 3)])),
    };
  }, []);

  useEffect(() => {
    // The program every effect uses, compiled now on a hidden copy kept until unmount
    const warm = makePoints(colors, 'radial', PARTICLES.radial([0, 0, 0], [0, -10, 0]));
    warm.visible = false;
    scene.add(warm);
    gl.compile(scene, camera);
    fxRef.current = {
      spawn: (kind, from, to) => {
        // Reduced motion: no flying particles
        if (reduced) return;
        const particles = PARTICLES[kind](from, to);
        const points = makePoints(colors, kind, particles);
        scene.add(points);
        live.current.push({
          points,
          velocities: new Float32Array(particles.flatMap((p) => p.slice(3))),
          gravity: kind === 'blocks' ? 3 : 0,
          age: 0,
        });
      },
      shatter: (at, type) => {
        if (reduced) return;
        const mesh = new InstancedMesh(
          VOXEL,
          new MeshBasicMaterial({ color: colors[type], toneMapped: false, transparent: true }),
          VOXELS
        );
        mesh.frustumCulled = false;
        const parts = Array.from({ length: VOXELS }, () => ({
          p: [
            at[0] + (Math.random() - 0.5) * 0.25,
            at[1] + (Math.random() - 0.5) * 0.25,
            at[2] + (Math.random() - 0.5) * 0.25,
          ],
          v: [(Math.random() - 0.5) * 2.4, Math.random() * 1.8, (Math.random() - 0.5) * 2.4],
          spin: Math.random() * 10,
        }));
        scene.add(mesh);
        shards.current.push({ mesh, parts, age: 0 });
      },
    };
    const effects = live.current;
    const bursts = shards.current;
    return () => {
      fxRef.current = null;
      freePoints(scene, warm);
      effects.forEach(({ points }) => freePoints(scene, points));
      effects.length = 0;
      bursts.forEach(({ mesh }) => freeShatter(scene, mesh));
      bursts.length = 0;
    };
    // The effects' colors are read once; the scene, renderer and camera are the Canvas's own
  }, [fxRef, reduced, scene, gl, camera, colors]);

  useFrame((state, delta) => {
    const dt = frozen(hitStop) ? 0 : Math.min(delta, 0.1);
    const effects = live.current;
    if (effects.length) {
      // In place: freed once FX_LIFE is up
      let kept = 0;
      effects.forEach((fx) => {
        fx.age += dt;
        if (fx.age >= FX_LIFE) {
          freePoints(scene, fx.points);
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
    }
    const bursts = shards.current;
    if (bursts.length) {
      let kept = 0;
      bursts.forEach((b) => {
        b.age += dt;
        if (b.age >= SHATTER_LIFE) {
          freeShatter(scene, b.mesh);
          return;
        }
        const k = 1 - b.age / SHATTER_LIFE;
        b.parts.forEach((part, i) => {
          part.v[1] -= 4 * dt;
          part.p[0] += part.v[0] * dt;
          part.p[1] = Math.max(0.03, part.p[1] + part.v[1] * dt);
          part.p[2] += part.v[2] * dt;
          dummy.position.set(...part.p);
          dummy.rotation.set(part.spin * b.age, part.spin * b.age * 0.7, 0);
          dummy.scale.setScalar(k);
          dummy.updateMatrix();
          b.mesh.setMatrixAt(i, dummy.matrix);
        });
        b.mesh.instanceMatrix.needsUpdate = true;
        b.mesh.material.opacity = k;
        bursts[kept] = b;
        kept += 1;
      });
      bursts.length = kept;
    }
  }, -1);
  return null;
};

// The threats' and crew's shapes, shared by every one of them
const SHAPES = {
  ddos: {
    core: new IcosahedronGeometry(0.15, 0),
    shell: new IcosahedronGeometry(0.25, 1),
    bit: new BoxGeometry(0.045, 0.045, 0.045),
  },
  sql: {
    core: new OctahedronGeometry(0.14, 0),
    shell: new TorusGeometry(0.23, 0.01, 6, 28),
    bit: new TetrahedronGeometry(0.05, 0),
  },
  // A swollen blob that drips
  memleak: {
    core: new SphereGeometry(0.16, 14, 10),
    shell: new IcosahedronGeometry(0.24, 2),
    bit: new SphereGeometry(0.035, 8, 6),
  },
  // A sharp, faceted shard
  zeroday: {
    core: new DodecahedronGeometry(0.13, 0),
    shell: new OctahedronGeometry(0.27, 0),
    bit: new TetrahedronGeometry(0.04, 0),
  },
  crew: {
    body: new CapsuleGeometry(0.085, 0.2, 4, 10),
    head: new SphereGeometry(0.07, 12, 8),
    base: new RingGeometry(0.14, 0.18, 28),
  },
};
const BITS = 4;

/**
 * The threats and the crew, as 3D entities. Threats drift toward the player once in sight,
 * unless `paused` (a dialogue is open) or motion is reduced; the crew stand where rooms.js puts
 * them. `pressure` counts the threats close enough to hurt (Cub3DWorld wears the player's
 * integrity down with it). `flat` (high contrast) draws them in flat bright colors, with no
 * trails, glitches or light
 */
const Entities = ({
  enemies,
  npcs,
  labels,
  solid,
  reduced,
  noFlash,
  paused,
  flat,
  pressureRef,
  slowRef,
  hitStop,
}) => {
  const time = useRef(0);
  const lights = useRef([]);
  const nodes = useRef({});

  // GPU resources made here, so freed here (they are not R3F's): per threat type and crew member
  const res = useMemo(() => {
    const colors = readGameTheme([
      'background',
      'foreground',
      ...new Set([...Object.values(THREAT_COLORS), ...NPCS.map((n) => n.color)]),
    ]);
    const made = { types: {}, crew: {}, textures: [] };
    const label = (color, text) => {
      const texture = labelTexture(colors, color, text);
      made.textures.push(texture);
      return new SpriteMaterial({ map: texture, depthWrite: false });
    };
    Object.entries(THREAT_COLORS).forEach(([type, color]) => {
      const base = toColor(colors[color]);
      // A Zero-Day fades in and out with the beam: every part of it takes an opacity
      const fades = !!THREAT_TYPES[type].stealth;
      made.types[type] = {
        base,
        core: flat
          ? new MeshBasicMaterial({ color: base })
          : new MeshStandardMaterial({
              color: base.clone().multiplyScalar(0.4),
              emissive: base,
              emissiveIntensity: 1.6,
              toneMapped: false,
              roughness: 0.3,
            }),
        // The shell stays a wireframe in high contrast too: filled, it hid the threat's shape
        shell: new MeshBasicMaterial({
          color: flat ? base : base.clone().multiplyScalar(1.3),
          wireframe: true,
          toneMapped: false,
          transparent: !flat,
          opacity: flat ? 1 : 0.75,
        }),
        bit: new MeshBasicMaterial({
          color: flat ? base : base.clone().multiplyScalar(2.5),
          toneMapped: false,
        }),
        label: label(color, labels[type]),
        fades,
      };
      if (fades) {
        ['core', 'shell', 'bit', 'label'].forEach((part) => {
          const m = made.types[type][part];
          m.transparent = true;
          m.userData.opacity = m.opacity;
          m.opacity = 0;
        });
      }
    });
    NPCS.forEach(({ id, color }) => {
      const base = toColor(colors[color]);
      made.crew[id] = {
        fill: new MeshBasicMaterial({
          color: flat ? base : base.clone().multiplyScalar(1.3),
          toneMapped: false,
          transparent: !flat,
          opacity: flat ? 1 : 0.35,
          depthWrite: flat,
        }),
        wire: new MeshBasicMaterial({
          color: flat ? toColor(colors.foreground) : base.clone().multiplyScalar(2.2),
          wireframe: true,
          toneMapped: false,
        }),
        label: label(color, labels[id]),
      };
    });
    // Every threat's trail in one set of points; faded by darkening, drawn additively
    const count = ENEMIES.length * TRAIL;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
    made.trailGeometry = geometry;
    made.trailMaterial = new PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    made.ages = new Float32Array(count).fill(TRAIL_LIFE);
    return made;
    // The crew and threats are fixed (rooms.js); labels change with the language
  }, [labels, flat]);
  useEffect(
    () => () => {
      res.textures.forEach((texture) => texture.dispose());
      [...Object.values(res.types), ...Object.values(res.crew)].forEach((set) =>
        Object.values(set).forEach((m) => m?.dispose?.())
      );
      res.trailGeometry.dispose();
      res.trailMaterial.dispose();
    },
    [res]
  );

  const blocked = (x, z) => solid(Math.floor(x), Math.floor(z));
  // Walls, and the props (racks, crates, the hub): threats no longer float through them
  const free = (x, z) =>
    !blocked(x - BODY, z - BODY) &&
    !blocked(x + BODY, z - BODY) &&
    !blocked(x - BODY, z + BODY) &&
    !blocked(x + BODY, z + BODY) &&
    !PROP_BOXES.some(
      ([x0, z0, x1, z1]) => x > x0 - BODY && x < x1 + BODY && z > z0 - BODY && z < z1 + BODY
    );
  const inSight = (x, z, tx, tz) => {
    const steps = Math.ceil(Math.hypot(tx - x, tz - z) / 0.1);
    for (let i = 1; i < steps; i += 1) {
      if (blocked(x + ((tx - x) * i) / steps, z + ((tz - z) * i) / steps)) return false;
    }
    return true;
  };

  // Where each threat's trail last dropped a point, and which slot is next
  const drops = useRef({});
  // Scratch: the threats close enough to light their surroundings, this frame
  const nearestRef = useRef([]);
  // The frame loop writes to the trail buffers: it reaches the resources here
  const resRef = useLiveRef(res);
  useFrame((state, delta) => {
    // A kill's freeze frame holds everything (the beam's reveal still follows the view)
    const dt = frozen(hitStop) ? 0 : Math.min(delta, 0.1);
    const r = resRef.current;
    const nearest = nearestRef.current;
    const { x: px, z: pz } = state.camera.position;
    const yaw = state.camera.rotation.y;
    // Its own clock: R3F's restarts at 0 whenever the frame loop mode changes
    time.current += dt;
    const t = time.current;
    let close = 0;
    let slowest = 1;
    nearest.length = 0;
    enemies.current.forEach((enemy, i) => {
      const node = nodes.current[enemy.id];
      if (!node || !enemy.alive) return;
      const kind = THREAT_TYPES[enemy.type];
      const d = Math.hypot(px - enemy.x, pz - enemy.z);
      // Line of sight, worked out once and only when something below needs it
      let sight;
      const seen = () => {
        if (sight === undefined) sight = inSight(enemy.x, enemy.z, px, pz);
        return sight;
      };
      if (!paused.current && !reduced && d < SIGHT && d > STOP && seen()) {
        const step = (kind.speed * dt) / d;
        const nx = enemy.x + (px - enemy.x) * step;
        const nz = enemy.z + (pz - enemy.z) * step;
        if (free(nx, enemy.z)) enemy.x = nx;
        if (free(enemy.x, nz)) enemy.z = nz;
      }
      if (kind.harm && d < REACH && seen()) close += 1;
      // A Memory Leak drags the player's steps, the more the closer
      if (kind.slows && d < SLOW_RANGE && seen()) {
        const k = MathUtils.clamp((d - SLOW_FULL) / (SLOW_RANGE - SLOW_FULL), 0, 1);
        slowest = Math.min(slowest, SLOWEST + (1 - SLOWEST) * k);
      }
      // A Zero-Day: lit only while the beam (the view's center, within its angle and range) is on
      // it, eased in and out over the penumbra (at once with reduced motion). Its material set is
      // its own type's: rooms.js has one Zero-Day
      if (kind.stealth) {
        const bearing = Math.atan2(-(enemy.x - px), -(enemy.z - pz));
        const off = Math.abs(
          MathUtils.euclideanModulo(bearing - yaw + Math.PI, 2 * Math.PI) - Math.PI
        );
        const beam =
          d < BEAM_RANGE && off < BEAM_ANGLE && seen()
            ? 1 - MathUtils.smoothstep(off, BEAM_FULL, BEAM_ANGLE)
            : 0;
        const was = enemy.lit ?? 0;
        enemy.lit = reduced ? beam : MathUtils.damp(was, beam, 12, Math.min(delta, 0.1));
        if (enemy.lit < 0.01) enemy.lit = 0;
        if (enemy.lit > 0.5) enemy.seen = true;
        // Written when it changes, or to a set just made (high contrast toggled)
        const set = r.types[enemy.type];
        if (set.lit !== enemy.lit) {
          set.lit = enemy.lit;
          ['core', 'shell', 'bit', 'label'].forEach((part) => {
            set[part].opacity = set[part].userData.opacity * enemy.lit;
          });
        }
        node.visible = enemy.lit > 0;
      }
      if (d < 6 && (!kind.stealth || enemy.lit > 0.5)) nearest.push([d, enemy]);
      // A slow float, a spin, and now and then a glitch (a jolt of the shell), unless reduced
      const y = reduced ? 0.5 : 0.5 + Math.sin(t * 2 + i) * 0.05;
      node.position.set(enemy.x, y, enemy.z);
      if (!reduced && !flat) {
        const [core, shell, bits] = node.children;
        core.rotation.set(t * 1.3 + i, t * 0.9, 0);
        shell.rotation.set(t * -0.6, t * 0.8 + i, 0);
        const glitch = Math.sin(t * 13 + i * 5) > 0.93;
        shell.scale.setScalar(glitch ? 1.18 : 1);
        shell.position.x = glitch ? Math.sin(t * 50) * 0.04 : 0;
        bits.rotation.y = t * 2.2 + i;
        // A Memory Leak's bits drip down and form again
        if (kind.slows) {
          bits.children.forEach((bit, b) => {
            bit.position.y = 0.05 - ((t * 0.5 + b / BITS) % 1) * 0.45;
          });
        }
      }
      // The trail: a point dropped every few centimeters moved (none behind a Zero-Day)
      if (!flat && !reduced && !kind.stealth) {
        if (!drops.current[enemy.id]) drops.current[enemy.id] = { x: enemy.x, z: enemy.z, slot: 0 };
        const drop = drops.current[enemy.id];
        if (Math.hypot(enemy.x - drop.x, enemy.z - drop.z) > 0.05) {
          const k = i * TRAIL + drop.slot;
          r.trailGeometry.attributes.position.setXYZ(k, enemy.x, y, enemy.z);
          r.ages[k] = 0;
          drop.slot = (drop.slot + 1) % TRAIL;
          drop.x = enemy.x;
          drop.z = enemy.z;
        }
      }
    });
    slowRef.current = paused.current ? 1 : slowest;
    pressureRef.current = paused.current ? 0 : close;

    if (!flat) {
      // The trails fade
      const colors = r.trailGeometry.attributes.color;
      enemies.current.forEach((enemy, i) => {
        const { base } = r.types[enemy.type];
        for (let s = 0; s < TRAIL; s += 1) {
          const k = i * TRAIL + s;
          r.ages[k] = enemy.alive ? Math.min(TRAIL_LIFE, r.ages[k] + dt) : TRAIL_LIFE;
          const f = (1 - r.ages[k] / TRAIL_LIFE) * 0.9;
          colors.setXYZ(k, base.r * f, base.g * f, base.b * f);
        }
      });
      colors.needsUpdate = true;
      r.trailGeometry.attributes.position.needsUpdate = true;
      // The nearest threats light their surroundings in their color
      nearest.sort((a, b) => a[0] - b[0]);
      lights.current.forEach((light, i) => {
        if (!light) return;
        const pick = nearest[i];
        if (!pick) {
          light.intensity = 0;
          return;
        }
        const [, enemy] = pick;
        light.position.set(enemy.x, 0.5, enemy.z);
        light.color.copy(r.types[enemy.type].base);
        light.intensity = reduced || noFlash ? 1.4 : 1.4 + Math.sin(t * 9 + i) * 0.3;
      });
    }
  }, -1);

  return (
    <>
      {enemies.current.map((enemy) => {
        const set = res.types[enemy.type];
        const shape = SHAPES[enemy.type];
        return (
          <group
            key={enemy.id}
            // An enemy's `node` lets a kill hide it without a render
            ref={(el) => {
              nodes.current[enemy.id] = el;
              enemy.node = el;
            }}
            position={[enemy.x, 0.5, enemy.z]}
            // A Zero-Day shows once the beam finds it
            visible={enemy.alive && (!THREAT_TYPES[enemy.type].stealth || enemy.lit > 0)}
          >
            <mesh geometry={shape.core} material={set.core} />
            <mesh geometry={shape.shell} material={set.shell} />
            <group>
              {Array.from({ length: BITS }, (_, b) => {
                const a = (b / BITS) * Math.PI * 2;
                return (
                  <mesh
                    key={a}
                    geometry={shape.bit}
                    material={set.bit}
                    position={[Math.cos(a) * 0.33, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.33]}
                  />
                );
              })}
            </group>
            <sprite material={set.label} position={[0, 0.34, 0]} scale={[0.36, 0.09, 1]} />
          </group>
        );
      })}
      {npcs.current.map((npc) => {
        const set = res.crew[npc.id];
        return (
          <group key={npc.id} position={[npc.x, 0, npc.z]}>
            <mesh
              geometry={SHAPES.crew.base}
              material={set.wire}
              position={[0, 0.01, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
            <mesh geometry={SHAPES.crew.body} material={set.fill} position={[0, 0.3, 0]} />
            <mesh geometry={SHAPES.crew.body} material={set.wire} position={[0, 0.3, 0]} />
            <mesh geometry={SHAPES.crew.head} material={set.fill} position={[0, 0.55, 0]} />
            <mesh geometry={SHAPES.crew.head} material={set.wire} position={[0, 0.55, 0]} />
            <sprite material={set.label} position={[0, 0.74, 0]} scale={[0.4, 0.1, 1]} />
          </group>
        );
      })}
      {!flat && (
        <>
          <points geometry={res.trailGeometry} material={res.trailMaterial} frustumCulled={false} />
          {Array.from({ length: LIGHTS }, (_, i) => (
            <pointLight
              key={i}
              ref={(el) => {
                lights.current[i] = el;
              }}
              intensity={0}
              distance={3}
              decay={2}
            />
          ))}
        </>
      )}
    </>
  );
};

/** The Skills hall's tech icons, floating; they load on their own, after the world */
const TechIcons = ({ icons, reduced, hitStop }) => {
  const textures = useTexture(icons);
  const refs = useRef([]);
  const time = useRef(0);
  useFrame((state, delta) => {
    if (reduced || frozen(hitStop)) return;
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
 * kept in `motion` for the 3D gauntlet; the crosshair's spread (wider while moving or just after
 * a shot) on `crosshairRef`; and a short screen shake after a shot. `motion` is shared with
 * Cub3DWorld: a shot adds to `kick` and sets `shake` (each weapon its own amount); `recoil` is a
 * spring toward `kick`: it snaps up within a few frames, then `kick` settles back slowly, the
 * weapon's weight. The bob's size follows the speed the player moves at (slowed: a smaller bob).
 * Then
 * `onTick(camera, dt)`: the aim, the radar, energy, integrity and automatic fire
 */
const GameMotion = ({ crosshairRef, motionRef, reduced, noFlash, hitStop, onTick }) => {
  // Seeded from the camera on the first frame, so the start (or a return) is not a jolt
  const last = useRef(null);
  useFrame((state, delta) => {
    const dt = frozen(hitStop) ? 0 : Math.min(delta, 0.1);
    const { camera } = state;
    const m = motionRef.current;
    if (!last.current) {
      last.current = {
        x: camera.position.x,
        z: camera.position.z,
        yaw: camera.rotation.y,
        phase: 0,
        amp: 0,
        sway: 0,
        moving: '',
        spread: -1,
      };
    }
    const l = last.current;
    const walked = Math.hypot(camera.position.x - l.x, camera.position.z - l.z);
    // The shortest way round: mouse look keeps the yaw in [-PI, PI], keys do not
    const turned =
      MathUtils.euclideanModulo(camera.rotation.y - l.yaw + Math.PI, 2 * Math.PI) - Math.PI;
    l.x = camera.position.x;
    l.z = camera.position.z;
    l.yaw = camera.rotation.y;
    // Recoil: a fast spring up to the kick (half-life about 18 ms), the kick itself settling back
    // more slowly (about 120 ms): sharp, then heavy
    m.kick = MathUtils.damp(m.kick ?? 0, 0, 5.8, dt);
    m.recoil = MathUtils.damp(m.recoil ?? 0, m.kick, 38, dt);
    m.shake = MathUtils.damp(m.shake, 0, 20, dt);
    const moving = walked > 0;
    if (reduced) {
      m.bobX = 0;
      m.bobY = 0;
      m.sway = 0;
    } else {
      const rate = dt > 0 ? turned / dt : 0;
      l.phase += walked * 4;
      // The bob's size: the share of full walking speed this frame moved at
      const speed = dt > 0 ? walked / dt : 0;
      l.amp = MathUtils.damp(l.amp, MathUtils.clamp(speed / MOVE_SPEED, 0, 1), 10, dt);
      l.sway = MathUtils.damp(l.sway, MathUtils.clamp(rate * 0.35, -1, 1), 8, dt);
      m.bobX = Math.sin(l.phase) * l.amp;
      m.bobY = Math.abs(Math.cos(l.phase)) * l.amp;
      m.sway = l.sway;
    }
    const el = crosshairRef.current;
    if (el) {
      const flag = String(moving);
      if (l.moving !== flag) el.dataset.moving = l.moving = flag;
      // In px: 4 standing still, up to 14 running or right after a shot
      const spread = Math.round(4 + (reduced ? (moving ? 6 : 0) : l.amp * 6) + m.recoil * 6);
      if (spread !== l.spread) {
        l.spread = spread;
        el.style.setProperty('--spread', `${spread}px`);
      }
    }
    // The pitch is pinned to the horizon otherwise: a shake is a few frames of jitter (none with
    // reduced motion or Reduce flashing)
    if (!reduced && !noFlash && m.shake > 0.01) {
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
  noFlash,
  flat,
  paused,
  pressure,
  slow,
  hitStop,
  fxRef,
  crosshairRef,
  motion,
  onTick,
}) {
  return (
    <>
      <Entities
        enemies={enemies}
        npcs={npcs}
        labels={labels}
        solid={solid}
        reduced={reduced}
        noFlash={noFlash}
        paused={paused}
        flat={flat}
        pressureRef={pressure}
        slowRef={slow}
        hitStop={hitStop}
      />
      <Effects reduced={reduced} fxRef={fxRef} hitStop={hitStop} />
      {icons && (
        <Suspense fallback={null}>
          <TechIcons icons={icons} reduced={reduced} hitStop={hitStop} />
        </Suspense>
      )}
      <GameMotion
        crosshairRef={crosshairRef}
        motionRef={motion}
        reduced={reduced}
        noFlash={noFlash}
        hitStop={hitStop}
        onTick={onTick}
      />
    </>
  );
});
