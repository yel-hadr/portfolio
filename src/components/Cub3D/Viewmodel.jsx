import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Euler,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SphereGeometry,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { LENS } from './flashlight';
import { frozen } from './freeze';
import { toColor } from './toColor';
import { useLiveRef } from '../../hooks/useLiveRef';

// Game Mode's weapons as 3D viewmodels in the camera's lower right, one procedural low-poly model
// per weapon (rooms.js order), built from plain boxes and cylinders: no model files, nearly no
// bytes. Metal parts are lit (meshStandardMaterial), so the flashlight and the room lights catch
// them; each weapon has its own glowing accent and a part that moves on a shot:
//   0 Kubernetes Kar98k: a long gunmetal rifle with a scope, a cyan energy cell and a bolt
//   1 Terraform Tactical: a blocky pistol, its slide set with green "infrastructure blocks"
//   2 The DevOps Defender: a heavy wide-barrel blaster with an orange radial heat sink and a pump
// Drawn over the world without a depth test, and in the transparent pass at full opacity, so it
// never sinks into a wall and nothing shows through it (sorted last by a high renderOrder).
// All three are mounted once and only the one in hand is shown, with one material set for all:
// a switch creates, disposes and compiles nothing. The flashlight's cone points down the view and
// never reaches the weapon, and one more light would cost every lit pixel of the world, so the
// metal instead reflects an environment map of its own (only the viewmodel uses it) baked from the
// flashlight as the weapon sees it, and turned with the camera every frame so its glints stay
// where the lens is. The metal is worn (a roughness map breaks up its highlights), the grips are
// rubber. A shot lights the muzzle (a star-shaped flash and one small light, kept mounted at zero
// so nothing recompiles) and the rifle's bolt and the pistol's slide throw a brass shell, drawn
// in the world from a fixed pool.

// In view: at 0.3 ahead the frustum spans about 0.17 to each side and 0.1 up and down. Held in
// from the corner, so the HUD's weapon card (bottom right) does not cover it
const BASE = [0.074, -0.062, -0.27];
const SCALE = 0.5;
// Turned in toward the crosshair and tipped a little, as a viewmodel is
const AIM = [-0.06, 0.16, 0];
// The weapon's own depth: the depth buffer is cleared just before it (DepthClear), so it is tested
// against itself only, never the world. Parts hide one another as solids do, whatever order they
// draw in (without a depth test, a far-side part painted over a near one: the scope's front lens
// glowed through the tube, the pistol's far blocks through its slide)
const OVER = { depthTest: true, depthWrite: true, transparent: true, fog: false };
// The muzzle flash still draws over everything
const ON_TOP = { depthTest: false, depthWrite: false, transparent: true, fog: false };
// How much of the flashlight environment the metal reflects
const ENV = 1;
// The muzzle light at a full flash (it lights the walls a few cells around), in camera space just
// ahead of the muzzle: outside the weapon's scaled group, so it lights the walls, not the barrel
// it would otherwise sit inside (three caps a light's falloff at 100 that close)
const MUZZLE_LIGHT = 2.5;
const MUZZLE_AT = [0.06, -0.04, -0.75];
// Each weapon's accent token (its glow) and how far its moving part travels on a shot
const ACCENT = ['secondary', 'success', 'primary'];
const TRAVEL = [0.06, 0.035, 0.05];

/** A part of the model: drawn after the world (the weapon's own depth is cleared first) */
const Part = (props) => <mesh renderOrder={20} {...props} />;

// Cylinders lie along the barrel (z): `back` is the radius toward the player, `front` away
const ALONG = [Math.PI / 2, 0, 0];
const Tube = ({ material, at, front, back = front, length, sides = 16, turn = ALONG }) => (
  <Part material={material} position={at} rotation={turn}>
    <cylinderGeometry args={[back, front, length, sides]} />
  </Part>
);
const Block = ({ material, at, size, turn }) => (
  <Part material={material} position={at} rotation={turn}>
    <boxGeometry args={size} />
  </Part>
);

/**
 * Clears the depth buffer just before the weapon draws: an invisible speck in the same
 * transparent pass, ordered just before its parts (renderOrder 19). The world's depth is gone by
 * then, so the weapon never sinks into a wall, and its parts still hide one another
 */
const clearDepth = (gl) => gl.clearDepth();
const DepthClear = ({ material, geometry }) => {
  const speck = useRef(null);
  useLayoutEffect(() => {
    const mesh = speck.current;
    if (mesh) mesh.onBeforeRender = clearDepth;
  }, []);
  return (
    <mesh
      ref={speck}
      renderOrder={19}
      frustumCulled={false}
      material={material}
      geometry={geometry}
    />
  );
};

const Rifle = ({ m, moving }) => (
  <>
    {/* Receiver, a rail on top, and the barrel out of a slim handguard to a muzzle brake */}
    <Block material={m.metal} at={[0, 0, 0]} size={[0.044, 0.05, 0.2]} />
    <Block material={m.dark} at={[0, 0.029, -0.005]} size={[0.026, 0.008, 0.21]} />
    <Block material={m.matte} at={[0, -0.006, -0.19]} size={[0.042, 0.04, 0.18]} />
    <Block material={m.matte} at={[0, -0.03, -0.18]} size={[0.03, 0.012, 0.15]} />
    <Tube material={m.metal} at={[0, 0.004, -0.36]} front={0.009} length={0.16} />
    <Tube material={m.dark} at={[0, 0.004, -0.45]} front={0.015} length={0.04} />
    {[-0.44, -0.455].map((z) => (
      <Block key={z} material={m.metal} at={[0, 0.004, z]} size={[0.032, 0.006, 0.006]} />
    ))}
    {/* Magazine, trigger guard and trigger, the pistol grip and the start of the stock (the rest
        is behind the eye) */}
    <Block
      material={m.dark}
      at={[0, -0.052, -0.035]}
      size={[0.03, 0.06, 0.05]}
      turn={[-0.12, 0, 0]}
    />
    <Block material={m.dark} at={[0, -0.052, 0.045]} size={[0.008, 0.005, 0.06]} />
    <Block material={m.dark} at={[0, -0.04, 0.015]} size={[0.008, 0.026, 0.005]} />
    <Block
      material={m.dark}
      at={[0, -0.036, 0.042]}
      size={[0.005, 0.02, 0.006]}
      turn={[0.3, 0, 0]}
    />
    <Block
      material={m.grip}
      at={[0, -0.065, 0.095]}
      size={[0.034, 0.08, 0.04]}
      turn={[0.32, 0, 0]}
    />
    <Block
      material={m.matte}
      at={[0, -0.016, 0.16]}
      size={[0.034, 0.048, 0.1]}
      turn={[-0.08, 0, 0]}
    />
    {/* The scope: a tube with flared ends in two rings, turrets, and lenses in the accent (the
        eyepiece's faces the player) */}
    <Tube material={m.dark} at={[0, 0.062, -0.005]} front={0.0135} length={0.15} />
    <Tube material={m.dark} at={[0, 0.062, -0.1]} front={0.021} back={0.0135} length={0.045} />
    <Tube material={m.dark} at={[0, 0.062, 0.085]} front={0.0135} back={0.017} length={0.03} />
    <Tube material={m.glow} at={[0, 0.062, -0.123]} front={0.018} length={0.002} />
    <Tube material={m.glow} at={[0, 0.062, 0.1]} front={0.012} length={0.002} />
    {[-0.05, 0.045].map((z) => (
      <group key={z}>
        <Tube material={m.metal} at={[0, 0.062, z]} front={0.0165} length={0.014} />
        <Block material={m.metal} at={[0, 0.042, z]} size={[0.018, 0.02, 0.014]} />
      </group>
    ))}
    <Tube material={m.metal} at={[0, 0.08, 0]} front={0.008} length={0.012} turn={[0, 0, 0]} />
    <Tube
      material={m.metal}
      at={[0.018, 0.062, 0]}
      front={0.007}
      length={0.012}
      turn={[0, 0, Math.PI / 2]}
    />
    {/* The energy cell in its cradle along the left side, the one in view, pulsing on a shot */}
    <Tube material={m.glow} at={[-0.028, -0.006, -0.03]} front={0.0085} length={0.085} sides={12} />
    {[-0.07, 0.01].map((z) => (
      <Tube
        key={z}
        material={m.dark}
        at={[-0.028, -0.006, z]}
        front={0.011}
        length={0.01}
        sides={12}
      />
    ))}
    {/* The bolt: slides back on a shot, its handle out to the right and down */}
    <group ref={moving}>
      <Tube material={m.metal} at={[0.02, 0.016, 0.05]} front={0.0075} length={0.07} sides={12} />
      <Tube
        material={m.metal}
        at={[0.036, 0.008, 0.07]}
        front={0.004}
        length={0.034}
        sides={8}
        turn={[0, 0, Math.PI / 2 + 0.5]}
      />
      <Part material={m.dark} position={[0.051, -0.001, 0.07]}>
        <sphereGeometry args={[0.009, 12, 8]} />
      </Part>
    </group>
  </>
);

const Pistol = ({ m, moving }) => (
  <>
    {/* Polymer frame with a dust cover, the trigger guard and trigger, a textured grip */}
    <Block material={m.matte} at={[0, -0.018, -0.035]} size={[0.05, 0.03, 0.19]} />
    <Block material={m.matte} at={[0, -0.038, -0.095]} size={[0.044, 0.014, 0.07]} />
    <Block material={m.matte} at={[0, -0.056, -0.02]} size={[0.012, 0.006, 0.055]} />
    <Block material={m.matte} at={[0, -0.045, -0.05]} size={[0.012, 0.026, 0.006]} />
    <Block
      material={m.dark}
      at={[0, -0.04, -0.012]}
      size={[0.006, 0.022, 0.006]}
      turn={[0.25, 0, 0]}
    />
    <Block
      material={m.grip}
      at={[0, -0.085, 0.055]}
      size={[0.048, 0.115, 0.058]}
      turn={[0.22, 0, 0]}
    />
    {[-0.07, -0.09, -0.11].map((y) => (
      <Block
        key={y}
        material={m.dark}
        at={[0, y, 0.06 + (y + 0.09) * -0.22]}
        size={[0.05, 0.006, 0.04]}
        turn={[0.22, 0, 0]}
      />
    ))}
    <Block
      material={m.dark}
      at={[0, -0.146, 0.07]}
      size={[0.052, 0.012, 0.062]}
      turn={[0.22, 0, 0]}
    />
    {/* The slide: recoils back on a shot. Sights (the front one a glowing dot), rear serrations,
        the ejection port, the bore, and a recessed band of glowing "infrastructure blocks" */}
    <group ref={moving}>
      <Block material={m.metal} at={[0, 0.016, -0.03]} size={[0.056, 0.036, 0.22]} />
      <Block material={m.dark} at={[0, 0.018, -0.06]} size={[0.058, 0.016, 0.13]} />
      {[-0.11, -0.085, -0.06, -0.035, -0.01].map((z) => (
        <Block key={z} material={m.glow} at={[0, 0.018, z]} size={[0.06, 0.009, 0.016]} />
      ))}
      {[0.035, 0.047, 0.059, 0.071].map((z) => (
        <Block key={z} material={m.dark} at={[0, 0.016, z]} size={[0.058, 0.026, 0.004]} />
      ))}
      <Block material={m.dark} at={[0.018, 0.034, 0.005]} size={[0.02, 0.002, 0.045]} />
      <Tube material={m.dark} at={[0, 0.012, -0.14]} front={0.009} length={0.004} />
      <Block material={m.dark} at={[0, 0.038, -0.128]} size={[0.006, 0.008, 0.01]} />
      <Block material={m.glow} at={[0, 0.0415, -0.124]} size={[0.004, 0.003, 0.003]} />
      {[-0.012, 0.012].map((x) => (
        <Block key={x} material={m.dark} at={[x, 0.038, 0.068]} size={[0.01, 0.009, 0.01]} />
      ))}
    </group>
  </>
);

// The heat sink's fins, round the barrel's hot core
const FINS = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);

const Blaster = ({ m, moving }) => (
  <>
    {/* A wide body under a top shroud, a power pack glowing along its left side, grip and guard */}
    <Block material={m.metal} at={[0, 0, 0.03]} size={[0.08, 0.07, 0.2]} />
    <Block material={m.matte} at={[0, 0.044, 0]} size={[0.066, 0.02, 0.25]} />
    <Block material={m.dark} at={[0, 0.058, 0.03]} size={[0.03, 0.008, 0.14]} />
    <Block material={m.dark} at={[-0.041, -0.005, 0.04]} size={[0.004, 0.05, 0.13]} />
    <Block material={m.glow} at={[-0.0435, -0.005, 0.04]} size={[0.002, 0.008, 0.1]} />
    <Block material={m.dark} at={[0, -0.05, 0.0]} size={[0.05, 0.035, 0.07]} />
    <Block
      material={m.grip}
      at={[0, -0.075, 0.085]}
      size={[0.05, 0.1, 0.055]}
      turn={[0.25, 0, 0]}
    />
    <Block material={m.dark} at={[0, -0.06, 0.04]} size={[0.01, 0.005, 0.045]} />
    {/* The barrel: a hot core in the accent between dark radial fins, held by two collars, to a
        muzzle flaring forward round a glowing bore */}
    <Tube material={m.metal} at={[0, 0.005, -0.15]} front={0.026} length={0.2} sides={20} />
    <Tube material={m.glow} at={[0, 0.005, -0.12]} front={0.034} length={0.1} sides={20} />
    {FINS.map((a) => (
      <Block
        key={a}
        material={m.dark}
        at={[Math.cos(a) * 0.044, 0.005 + Math.sin(a) * 0.044, -0.12]}
        size={[0.022, 0.004, 0.096]}
        turn={[0, 0, a]}
      />
    ))}
    {[-0.172, -0.068].map((z) => (
      <Tube key={z} material={m.metal} at={[0, 0.005, z]} front={0.052} length={0.01} sides={20} />
    ))}
    <Tube
      material={m.dark}
      at={[0, 0.005, -0.265]}
      front={0.04}
      back={0.03}
      length={0.035}
      sides={20}
    />
    <Tube material={m.glow} at={[0, 0.005, -0.28]} front={0.018} length={0.004} sides={20} />
    {/* The pump under the barrel: slides back on a blast, ridged for the hand */}
    <group ref={moving}>
      <Tube material={m.matte} at={[0, -0.042, -0.13]} front={0.019} length={0.11} sides={14} />
      {[-0.165, -0.13, -0.095].map((z) => (
        <Tube
          key={z}
          material={m.dark}
          at={[0, -0.042, z]}
          front={0.0205}
          length={0.007}
          sides={14}
        />
      ))}
    </group>
  </>
);

/**
 * The flashlight as the weapon sees it, in camera space, prefiltered for the metal: the lens behind
 * and to the left (toward LENS from the weapon), the beam's lit wall ahead, a faint fill around
 */
const bakeFlashlight = (gl, light) => {
  const scene = new Scene();
  const parts = [];
  const add = (geometry, k, at, side) => {
    const material = new MeshBasicMaterial({ color: light.clone().multiplyScalar(k), side });
    const mesh = new Mesh(geometry, material);
    if (at) mesh.position.copy(at);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
    parts.push(geometry, material);
  };
  add(new SphereGeometry(20, 16, 8), 0.07, null, BackSide);
  const lens = new Vector3(LENS[0] - BASE[0], LENS[1] - BASE[1], LENS[2] - BASE[2]).normalize();
  add(new SphereGeometry(2.2, 24, 12), 6, lens.multiplyScalar(6));
  add(new PlaneGeometry(16, 10), 0.6, new Vector3(0, 0, -8));
  const pmrem = new PMREMGenerator(gl);
  const target = pmrem.fromScene(scene, 0.04);
  pmrem.dispose();
  parts.forEach((part) => part.dispose());
  return target;
};

// A repeatable pseudo-random sequence (the same wear on every load)
const seeded = (seed) => {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};

/** Worn metal: a roughness map (green channel, 0.7 to 1 of the material's roughness) */
const makeWear = () => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const random = seeded(42);
  for (let i = 0; i < size * size; i += 1) {
    // Fine grain, with now and then a polished (smoother) streak along the part
    const streak = (i % size) % 9 === 0 ? -40 : 0;
    const v = 180 + Math.floor(random() * 75) + streak;
    image.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  return new CanvasTexture(canvas);
};

/** The muzzle flash: a hot core with four spikes, white on black (added to what is behind) */
const makeStar = () => {
  const size = 128;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const core = ctx.createRadialGradient(half, half, 0, half, half, half);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  core.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate((i * Math.PI) / 2);
    const spike = ctx.createLinearGradient(0, 0, half, 0);
    spike.addColorStop(0, 'rgba(255,255,255,0.9)');
    spike.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spike;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(half, 0);
    ctx.lineTo(0, 5);
    ctx.fill();
    ctx.restore();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

// Scratch for turning the environment with the camera (no allocation per frame)
const turn = new Matrix4();
const facing = new Quaternion();
const back = new Euler();

const MODELS = [Rifle, Pistol, Blaster];
// Each model's size in hand (the blaster's wide barrel would fill the view at full size)
const SIZE = [1, 1, 0.78];
const FLASH_AT = [-0.49, -0.16, -0.3];
// Where a shell leaves the weapon (model units): the rifle's bolt, the pistol's ejection port
const PORT = [
  [0.03, 0.026, 0.045],
  [0.03, 0.036, 0.005],
  [0, 0, 0],
];

// Spent shells: a fixed pool, drawn in the world (depth-tested, lit) where they land
const SHELLS = 12;
const SHELL_LIFE = 0.9; // s
// Cells per s²: a wall (1 high) is about 2.5 m, so this is about earth's gravity
const GRAVITY = 4;
const hidden = new Matrix4().makeScale(0, 0, 0);
const at = new Vector3();
const right = new Vector3();
const up = new Vector3();
const ahead = new Vector3();
const place = new Object3D();

/**
 * A shell from the pool, thrown from `from`: out to the right, up and a little forward, slow enough
 * (it starts a hand's width from the eye) to be seen arcing over the weapon for about a third of
 * a second before it drops out of view, with a spin
 */
const throwShell = (shell, from) => {
  shell.age = 0;
  shell.bounced = false;
  shell.p.copy(from);
  shell.v
    .copy(right)
    .multiplyScalar(0.22 + Math.random() * 0.12)
    .addScaledVector(up, 0.55 + Math.random() * 0.2)
    .addScaledVector(ahead, 0.4 + Math.random() * 0.2);
  shell.spin.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 30);
  shell.r.set(0, Math.random() * Math.PI, 0);
};

/**
 * A shell's flight for `dt`: falling, one bounce off the floor that takes most of its speed, then
 * at rest. Writes its matrix to `instances` (hidden once its life is over); false if already gone
 */
const flyShell = (shell, i, dt, instances) => {
  if (shell.age >= SHELL_LIFE) return false;
  shell.age += dt;
  if (shell.age >= SHELL_LIFE) {
    instances.setMatrixAt(i, hidden);
    return true;
  }
  shell.v.y -= GRAVITY * dt;
  shell.p.addScaledVector(shell.v, dt);
  shell.r.addScaledVector(shell.spin, dt);
  if (shell.p.y < 0.006) {
    shell.p.y = 0.006;
    if (shell.bounced) {
      shell.v.set(0, 0, 0);
      shell.spin.set(0, 0, 0);
    } else {
      shell.bounced = true;
      shell.v.set(shell.v.x * 0.4, -shell.v.y * 0.3, shell.v.z * 0.4);
      shell.spin.multiplyScalar(0.3);
    }
  }
  place.position.copy(shell.p);
  place.rotation.set(shell.r.x, shell.r.y, shell.r.z);
  place.scale.setScalar(1);
  place.updateMatrix();
  instances.setMatrixAt(i, place.matrix);
  return true;
};

/**
 * The shells the rifle and pistol throw: spawned at the ejection port (`portRef`, in the world)
 * whenever `motion.eject` counts up, thrown up and to the right with a spin, falling, bouncing once
 * off the floor and gone after SHELL_LIFE. One InstancedMesh, made once: no allocation per shot,
 * and its geometry and material are freed when Game Mode closes
 */
const ShellCasings = ({
  world,
  motionRef,
  portRef,
  hitStopRef,
  pausedRef,
  reduced,
  flat,
  colors,
}) => {
  const mesh = useRef(null);
  const pool = useRef(null);
  const seen = useRef(null);
  const resources = useMemo(() => {
    // Brass from the theme: the orange pulled toward the green is a dull gold
    const brass = toColor(colors.primary, 0.8).lerp(toColor(colors.success, 0.8), 0.35);
    return {
      // About a real casing's size: it starts a hand's width from the eye
      geometry: new BoxGeometry(0.007, 0.007, 0.018),
      material: flat
        ? new MeshBasicMaterial({ color: brass })
        : // Not fully metallic: with no environment of their own, they would show black
          // and a faint glow of their own (hot brass), so they read against the dark facility
          new MeshStandardMaterial({
            color: brass,
            metalness: 0.6,
            roughness: 0.35,
            emissive: brass.clone().multiplyScalar(0.3),
          }),
    };
  }, [colors, flat]);
  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
    },
    [resources]
  );
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    for (let i = 0; i < SHELLS; i += 1) instances.setMatrixAt(i, hidden);
    instances.instanceMatrix.needsUpdate = true;
    pool.current = Array.from({ length: SHELLS }, () => ({
      age: Infinity,
      p: new Vector3(),
      v: new Vector3(),
      spin: new Vector3(),
      r: new Vector3(),
      bounced: false,
    }));
  }, [resources]);

  useFrame((state, delta) => {
    const instances = mesh.current;
    const shells = pool.current;
    const m = motionRef.current;
    if (!instances || !shells) return;
    // New shots since the last frame: one shell each (none with reduced motion)
    const count = m.eject ?? 0;
    if (seen.current === null) seen.current = count;
    let fresh = count - seen.current;
    seen.current = count;
    const port = portRef.current;
    if (!reduced && port && fresh > 0) {
      port.getWorldPosition(at);
      const { camera } = state;
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      ahead.setFromMatrixColumn(camera.matrixWorld, 2).negate();
      for (const shell of shells) {
        if (fresh <= 0) break;
        if (shell.age < SHELL_LIFE) continue;
        fresh -= 1;
        throwShell(shell, at);
      }
    }
    // Held by a kill's freeze frame, and while the game is paused (frames on demand: a dialog,
    // the menu), as the threats are
    const paused = !!pausedRef?.current;
    const dt = frozen(hitStopRef) || paused ? 0 : Math.min(delta, 0.1);
    let alive = false;
    for (let i = 0; i < SHELLS; i += 1) {
      if (flyShell(shells[i], i, dt, instances)) alive = true;
    }
    // No shell in flight: no draw at all (it stays in the render list, its program compiled)
    instances.count = alive ? SHELLS : 0;
    if (alive) {
      instances.instanceMatrix.needsUpdate = true;
      if (!paused) state.invalidate();
    }
  });

  return createPortal(
    <instancedMesh
      ref={mesh}
      args={[resources.geometry, resources.material, SHELLS]}
      frustumCulled={false}
      castShadow={false}
    />,
    world
  );
};

/**
 * @param weapon  the weapon in hand (index into rooms.js WEAPON_FX)
 * @param motionRef  Cub3DWorld's shared ref: recoil, kick, flash and eject (set by a shot), bob and
 *   sway (GameMotion)
 * @param colors  theme channels from Facility: { dark, muted, light, primary, success, secondary }
 * @param flashlight  the flashlight's color (three Color), for the metal's reflections
 * @param hitStopRef  a kill's freeze frame (freeze.js): the weapon holds still with the world
 * @param world  the scene itself (from Facility): inside the camera's portal R3F's own `scene` is the
 *   camera, and the shells must fly in the world
 */
const Viewmodel = ({
  weapon,
  motionRef,
  reduced,
  noFlash,
  flat,
  colors,
  flashlight,
  hitStopRef,
  pausedRef,
  world,
}) => {
  const gl = useThree((s) => s.gl);
  const group = useRef(null);
  const moving = useRef([]);
  const flash = useRef(null);
  const light = useRef(null);
  const port = useRef(null);
  const time = useRef(0);
  // The last flash's strength, so a new one (a jump up) gets its own roll
  const lastBurst = useRef(0);

  // The flashlight's reflections, prefiltered once (none in high contrast, which is unlit)
  const env = useMemo(
    () => (flat || !flashlight ? null : bakeFlashlight(gl, flashlight)),
    [gl, flat, flashlight]
  );
  useEffect(() => () => env?.dispose(), [env]);

  // The speck that clears the depth buffer before the weapon: draws nothing itself
  const speck = useMemo(
    () => ({
      geometry: new PlaneGeometry(1e-4, 1e-4),
      material: new MeshBasicMaterial({ colorWrite: false, ...ON_TOP }),
    }),
    []
  );
  useEffect(
    () => () => {
      speck.geometry.dispose();
      speck.material.dispose();
    },
    [speck]
  );

  // Each weapon's accent, for its muzzle light (plain colors: nothing to free)
  const accents = useMemo(() => ACCENT.map((a) => toColor(colors[a])), [colors]);

  const materials = useMemo(() => {
    const color = (name, k = 1) => toColor(colors[name], k);
    if (flat) {
      // High contrast: flat, unlit tones, each accent bright; no muzzle flash at all
      const basic = (c) => new MeshBasicMaterial({ color: c, ...OVER });
      return {
        metal: basic(color('muted')),
        matte: basic(color('muted', 0.75)),
        dark: basic(color('dark')),
        grip: basic(color('dark').lerp(color('muted'), 0.3)),
        glow: ACCENT.map((a) => basic(color(a))),
        flash: ACCENT.map((a) => new SpriteMaterial({ color: color(a), opacity: 0, ...ON_TOP })),
      };
    }
    const envMap = env?.texture ?? null;
    const wear = makeWear();
    const star = makeStar();
    const lit = (params) =>
      new MeshStandardMaterial({ envMap, envMapIntensity: ENV, ...OVER, ...params });
    return {
      wear,
      star,
      // Worn gunmetal: fully metallic, its highlights broken up by the wear map, so the flashlight
      // (and the room light) catch the barrel's edges without a mirror finish
      metal: lit({
        color: color('muted', 0.3),
        metalness: 0.92,
        roughness: 0.38,
        roughnessMap: wear,
        emissive: color('muted', 0.03),
      }),
      // Polymer, for the pistol's frame
      matte: lit({ color: color('muted', 0.2), metalness: 0.1, roughness: 0.7 }),
      // Dark blued steel: the shroud, the scope, the pump
      dark: lit({
        color: color('dark').lerp(color('muted'), 0.14),
        metalness: 1,
        roughness: 0.5,
        roughnessMap: wear,
      }),
      // Rubber grips: no metal, a dull sheen
      grip: lit({
        color: color('dark').lerp(color('muted'), 0.08),
        metalness: 0.05,
        roughness: 0.82,
      }),
      // Each weapon's accent
      glow: ACCENT.map((a) =>
        lit({
          color: color(a, 0.3),
          emissive: color(a),
          emissiveIntensity: 2.2,
          toneMapped: false,
          envMap: null,
        })
      ),
      // The flash: added light over the scene, past 1 so it blooms
      flash: ACCENT.map(
        (a) =>
          new SpriteMaterial({
            map: star,
            color: color(a, 3).lerp(color('light', 3), 0.5),
            blending: AdditiveBlending,
            toneMapped: false,
            opacity: 0,
            ...ON_TOP,
          })
      ),
    };
  }, [colors, flat, env]);
  // The materials whose environment turns with the camera (an array made once, not per frame)
  const reflective = useMemo(
    () => (flat ? [] : [materials.metal, materials.matte, materials.dark, materials.grip]),
    [materials, flat]
  );
  useEffect(
    () => () =>
      Object.values(materials)
        .flat()
        .forEach((resource) => resource.dispose()),
    [materials]
  );
  // The frame loop writes to the materials (the env's turn, the glow): it reaches them here
  const materialsRef = useLiveRef(materials);
  const reflectiveRef = useLiveRef(reflective);
  const accentsRef = useLiveRef(accents);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    // A kill's freeze frame holds the weapon's pose; the flash still fades on real time
    const realDt = Math.min(delta, 0.1);
    const dt = frozen(hitStopRef) ? 0 : realDt;
    time.current += dt;
    const m = motionRef.current;
    const mats = materialsRef.current;
    const recoil = m.recoil ?? 0;
    // The environment turns with the camera: its world-to-camera rotation, written so that three's
    // own sign flip for PMREMs gives it back exactly
    if (env) {
      state.camera.getWorldQuaternion(facing);
      back.setFromRotationMatrix(turn.makeRotationFromQuaternion(facing).invert(), 'XYZ');
      for (const mat of reflectiveRef.current) {
        mat.envMapRotation.set(-back.x, -back.y, -back.z, 'XYZ');
      }
    }
    if (reduced) {
      g.position.set(...BASE);
      g.rotation.set(...AIM);
    } else {
      // Breathing at rest, the walk's bob and the turn's sway (each bounded, so the weapon never
      // drifts off its place), then the kick: back and up
      const t = time.current;
      const breath = Math.sin(t * 1.6) * 0.0016;
      const bx = MathUtils.clamp(m.bobX ?? 0, -1, 1);
      const by = MathUtils.clamp(m.bobY ?? 0, 0, 1);
      const sway = MathUtils.clamp(m.sway ?? 0, -1, 1);
      g.position.set(
        BASE[0] + bx * 0.012 + sway * 0.03,
        BASE[1] + by * 0.01 + breath + recoil * 0.012,
        BASE[2] + recoil * 0.075
      );
      g.rotation.set(
        AIM[0] + recoil * 0.32 + Math.sin(t * 1.1) * 0.006,
        AIM[1] + sway * 0.08,
        -recoil * 0.05 + Math.sin(t * 0.8) * 0.004
      );
    }
    // The moving part (bolt, slide or pump): back on a shot, home again as the recoil eases
    const part = moving.current[weapon];
    if (part) part.position.z = reduced ? 0 : recoil * TRAVEL[weapon];
    // The muzzle flash: `flash`, set by a shot at most three times a second (WCAG 2.3.1, however
    // fast the pistol fires), eased out here; none with reduced motion, Reduce flashing or in
    // high contrast
    m.flash = MathUtils.damp(m.flash ?? 0, 0, 12, realDt);
    const burst = reduced || noFlash || flat ? 0 : m.flash;
    const sprite = flash.current;
    if (sprite) {
      // A new flash turns the star to a new angle
      if (burst > lastBurst.current + 0.3) sprite.material.rotation = Math.random() * Math.PI;
      sprite.material.opacity = burst;
      sprite.scale.setScalar(0.05 + burst * 0.11);
    }
    lastBurst.current = burst;
    // Its light on the walls around, in the weapon's accent, gone as fast as the flash
    const lamp = light.current;
    if (lamp) {
      lamp.intensity = burst * MUZZLE_LIGHT;
      lamp.color.copy(accentsRef.current[weapon]);
    }
    // The accent glows hotter with a shot (the cell pulses, the heat sink flares), steady with
    // Reduce flashing
    if (!flat) mats.glow[weapon].emissiveIntensity = 2.2 + burst * 4;
  });

  return (
    <>
      <DepthClear material={speck.material} geometry={speck.geometry} />
      <group ref={group} position={BASE} scale={SCALE * SIZE[weapon]}>
        {MODELS.map((Model, i) => (
          <group key={i} visible={i === weapon}>
            <Model
              m={{ ...materials, glow: materials.glow[i] }}
              moving={(el) => (moving.current[i] = el)}
            />
          </group>
        ))}
        <sprite
          ref={flash}
          material={materials.flash[weapon]}
          position={[0, 0.005, FLASH_AT[weapon]]}
          renderOrder={30}
        />
        <object3D ref={port} position={PORT[weapon]} />
      </group>
      {/* The muzzle light, ahead of the barrel (camera space). Mounted at zero and pulsed: a light
          that came and went would recompile every lit material. None in high contrast, which is
          unlit */}
      {!flat && (
        <pointLight ref={light} position={MUZZLE_AT} intensity={0} distance={4} decay={2} />
      )}
      {/* Always mounted, so a weapon switch creates nothing: only the rifle and the pistol count
          up `eject` (rooms.js `shell`) */}
      <ShellCasings
        world={world}
        motionRef={motionRef}
        portRef={port}
        hitStopRef={hitStopRef}
        pausedRef={pausedRef}
        reduced={reduced}
        flat={flat}
        colors={colors}
      />
    </>
  );
};

export default Viewmodel;
