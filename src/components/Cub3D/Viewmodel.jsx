import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  Euler,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { LENS } from './flashlight';
import { toColor } from './toColor';

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
// where the lens is.

// In view: at 0.3 ahead the frustum spans about 0.17 to each side and 0.1 up and down
const BASE = [0.092, -0.07, -0.27];
const SCALE = 0.5;
// Turned in toward the crosshair and tipped a little, as a viewmodel is
const AIM = [-0.06, 0.16, 0];
const OVER = { depthTest: false, depthWrite: false, transparent: true, fog: false };
// How much of the flashlight environment the metal reflects
const ENV = 0.9;
// Each weapon's accent token (its glow) and how far its moving part travels on a shot
const ACCENT = ['secondary', 'success', 'primary'];
const TRAVEL = [0.06, 0.035, 0.05];

/** A part of the model: drawn after the world, in its own order inside the model */
const Part = ({ order = 0, ...props }) => <mesh renderOrder={20 + order} {...props} />;

const Rifle = ({ m, moving }) => (
  <>
    {/* Receiver, long barrel in its shroud, a stock behind */}
    <Part material={m.metal} position={[0, 0, 0.02]}>
      <boxGeometry args={[0.05, 0.06, 0.24]} />
    </Part>
    <Part material={m.metal} position={[0, 0.004, -0.24]} rotation={[Math.PI / 2, 0, 0]} order={1}>
      <cylinderGeometry args={[0.011, 0.011, 0.3, 10]} />
    </Part>
    <Part material={m.dark} position={[0, 0.004, -0.15]} rotation={[Math.PI / 2, 0, 0]} order={2}>
      <cylinderGeometry args={[0.02, 0.02, 0.12, 8]} />
    </Part>
    <Part material={m.dark} position={[0, -0.012, 0.18]}>
      <boxGeometry args={[0.04, 0.07, 0.1]} />
    </Part>
    <Part material={m.dark} position={[0, -0.06, 0.06]} rotation={[0.3, 0, 0]}>
      <boxGeometry args={[0.035, 0.08, 0.04]} />
    </Part>
    {/* The scope: a tube on two mounts, its lens in the accent */}
    <Part material={m.dark} position={[0, 0.058, 0]} rotation={[Math.PI / 2, 0, 0]} order={2}>
      <cylinderGeometry args={[0.016, 0.016, 0.14, 12]} />
    </Part>
    <Part material={m.glow} position={[0, 0.058, -0.071]} rotation={[Math.PI / 2, 0, 0]} order={3}>
      <cylinderGeometry args={[0.012, 0.012, 0.004, 12]} />
    </Part>
    {[-0.04, 0.04].map((z) => (
      <Part key={z} material={m.metal} position={[0, 0.038, z]} order={1}>
        <boxGeometry args={[0.012, 0.02, 0.012]} />
      </Part>
    ))}
    {/* The energy cell along its side, pulsing on a shot */}
    <Part material={m.glow} position={[0.03, -0.005, 0.03]} order={3}>
      <boxGeometry args={[0.012, 0.024, 0.11]} />
    </Part>
    {/* The bolt: slides back on a shot */}
    <group ref={moving}>
      <Part material={m.metal} position={[0.03, 0.022, 0.07]} order={3}>
        <boxGeometry args={[0.014, 0.014, 0.05]} />
      </Part>
      <Part
        material={m.dark}
        position={[0.045, 0.022, 0.085]}
        rotation={[0, 0, Math.PI / 2]}
        order={4}
      >
        <cylinderGeometry args={[0.008, 0.008, 0.02, 8]} />
      </Part>
    </group>
  </>
);

const Pistol = ({ m, moving }) => (
  <>
    {/* Frame and grip, a square muzzle */}
    <Part material={m.matte} position={[0, -0.012, -0.02]}>
      <boxGeometry args={[0.055, 0.04, 0.2]} />
    </Part>
    <Part material={m.matte} position={[0, -0.075, 0.05]} rotation={[0.22, 0, 0]}>
      <boxGeometry args={[0.05, 0.11, 0.055]} />
    </Part>
    <Part material={m.dark} position={[0, -0.045, -0.02]}>
      <boxGeometry args={[0.02, 0.025, 0.06]} />
    </Part>
    {/* The slide: recoils back on a shot, its side set with glowing blocks */}
    <group ref={moving}>
      <Part material={m.metal} position={[0, 0.026, -0.03]} order={1}>
        <boxGeometry args={[0.06, 0.038, 0.22]} />
      </Part>
      <Part material={m.dark} position={[0, 0.026, -0.145]} order={2}>
        <boxGeometry args={[0.03, 0.03, 0.012]} />
      </Part>
      {[
        [0.031, 0.034, -0.08],
        [0.031, 0.018, -0.05],
        [0.031, 0.034, -0.02],
        [0.031, 0.018, 0.01],
        [-0.031, 0.026, -0.06],
        [-0.031, 0.026, -0.0],
      ].map(([x, y, z]) => (
        <Part key={`${x}${y}${z}`} material={m.glow} position={[x, y, z]} order={3}>
          <boxGeometry args={[0.006, 0.012, 0.022]} />
        </Part>
      ))}
    </group>
  </>
);

const Blaster = ({ m, moving }) => (
  <>
    {/* A wide body, and a heavy barrel with a flared muzzle */}
    <Part material={m.metal} position={[0, 0, 0.03]}>
      <boxGeometry args={[0.085, 0.075, 0.2]} />
    </Part>
    <Part material={m.metal} position={[0, 0.005, -0.15]} rotation={[Math.PI / 2, 0, 0]} order={1}>
      <cylinderGeometry args={[0.032, 0.036, 0.2, 14]} />
    </Part>
    <Part material={m.dark} position={[0, 0.005, -0.255]} rotation={[Math.PI / 2, 0, 0]} order={2}>
      <cylinderGeometry args={[0.042, 0.034, 0.03, 14]} />
    </Part>
    <Part material={m.dark} position={[0, -0.07, 0.07]} rotation={[0.25, 0, 0]}>
      <boxGeometry args={[0.05, 0.1, 0.055]} />
    </Part>
    {/* The radial heat sink: fins round the barrel, glowing hotter with each blast */}
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <Part
          key={a}
          material={m.glow}
          position={[Math.cos(a) * 0.045, 0.005 + Math.sin(a) * 0.045, -0.1]}
          rotation={[0, 0, a]}
          order={3}
        >
          <boxGeometry args={[0.016, 0.005, 0.09]} />
        </Part>
      );
    })}
    {/* The pump under the barrel: slides back on a blast */}
    <group ref={moving}>
      <Part material={m.dark} position={[0, -0.04, -0.12]} rotation={[Math.PI / 2, 0, 0]} order={2}>
        <cylinderGeometry args={[0.018, 0.018, 0.1, 10]} />
      </Part>
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

// Scratch for turning the environment with the camera (no allocation per frame)
const turn = new Matrix4();
const facing = new Quaternion();
const back = new Euler();

const MODELS = [Rifle, Pistol, Blaster];
// Each model's size in hand (the blaster's wide barrel would fill the view at full size)
const SIZE = [1, 1, 0.78];
const FLASH_AT = [-0.4, -0.16, -0.28];

/**
 * @param weapon  the weapon in hand (index into rooms.js WEAPON_FX)
 * @param motion  Cub3DWorld's shared ref: recoil and flash (set by a shot), bob and sway (GameMotion)
 * @param colors  theme channels from Facility: { dark, muted, light, primary, success, secondary }
 * @param flashlight  the flashlight's color (three Color), for the metal's reflections
 */
const Viewmodel = ({ weapon, motion, reduced, noFlash, flat, colors, flashlight }) => {
  const gl = useThree((s) => s.gl);
  const group = useRef(null);
  const moving = useRef([]);
  const flash = useRef(null);
  const time = useRef(0);

  // The flashlight's reflections, prefiltered once (none in high contrast, which is unlit)
  const env = useMemo(
    () => (flat || !flashlight ? null : bakeFlashlight(gl, flashlight)),
    [gl, flat, flashlight]
  );
  useEffect(() => () => env?.dispose(), [env]);

  const materials = useMemo(() => {
    const color = (name, k = 1) => toColor(colors[name], k);
    if (flat) {
      // High contrast: flat, unlit tones, each accent bright
      const basic = (c) => new MeshBasicMaterial({ color: c, ...OVER });
      return {
        metal: basic(color('muted')),
        matte: basic(color('muted', 0.75)),
        dark: basic(color('dark')),
        glow: ACCENT.map((a) => basic(color(a))),
        flash: ACCENT.map((a) => new MeshBasicMaterial({ color: color(a), opacity: 0, ...OVER })),
      };
    }
    const envMap = env?.texture ?? null;
    return {
      // Gunmetal: dark and very metallic, so lights draw sharp highlights along its edges
      metal: new MeshStandardMaterial({
        color: color('muted', 0.26),
        metalness: 0.8,
        roughness: 0.2,
        emissive: color('muted', 0.03),
        envMap,
        envMapIntensity: ENV,
        ...OVER,
      }),
      // Matte polymer, for the pistol's frame
      matte: new MeshStandardMaterial({
        color: color('muted', 0.18),
        metalness: 0.2,
        roughness: 0.85,
        envMap,
        envMapIntensity: ENV,
        ...OVER,
      }),
      dark: new MeshStandardMaterial({
        color: color('dark').lerp(color('muted'), 0.12),
        metalness: 0.6,
        roughness: 0.45,
        envMap,
        envMapIntensity: ENV,
        ...OVER,
      }),
      // Each weapon's accent
      glow: ACCENT.map(
        (a) =>
          new MeshStandardMaterial({
            color: color(a, 0.3),
            emissive: color(a),
            emissiveIntensity: 2.2,
            toneMapped: false,
            ...OVER,
          })
      ),
      flash: ACCENT.map(
        (a) => new MeshBasicMaterial({ color: color(a, 3), toneMapped: false, opacity: 0, ...OVER })
      ),
    };
  }, [colors, flat, env]);
  useEffect(
    () => () =>
      Object.values(materials)
        .flat()
        .forEach((mat) => mat.dispose()),
    [materials]
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    time.current += dt;
    const m = motion.current;
    const recoil = m.recoil ?? 0;
    // The environment turns with the camera: its world-to-camera rotation, written so that three's
    // own sign flip for PMREMs gives it back exactly
    if (env) {
      state.camera.getWorldQuaternion(facing);
      back.setFromRotationMatrix(turn.makeRotationFromQuaternion(facing).invert(), 'XYZ');
      for (const mat of [materials.metal, materials.matte, materials.dark]) {
        mat.envMapRotation.set(-back.x, -back.y, -back.z, 'XYZ');
      }
    }
    if (reduced) {
      g.position.set(...BASE);
      g.rotation.set(...AIM);
    } else {
      // Breathing at rest, the walk's bob and the turn's sway, then the kick: back and up
      const t = time.current;
      const breath = Math.sin(t * 1.6) * 0.0016;
      const bx = m.bobX ?? 0;
      const by = m.bobY ?? 0;
      const sway = m.sway ?? 0;
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
    // fast the pistol fires), eased out here; none with reduced motion or Reduce flashing
    m.flash = MathUtils.damp(m.flash ?? 0, 0, 12, dt);
    const burst = reduced || noFlash ? 0 : m.flash;
    if (flash.current) {
      flash.current.material.opacity = burst;
      flash.current.scale.setScalar(0.6 + burst * 1.4);
    }
    // The accent glows hotter with a shot (the cell pulses, the heat sink flares), steady with
    // Reduce flashing
    if (!flat) materials.glow[weapon].emissiveIntensity = 2.2 + burst * 4;
  });

  return (
    <group ref={group} position={BASE} scale={SCALE * SIZE[weapon]}>
      {MODELS.map((Model, i) => (
        <group key={i} visible={i === weapon}>
          <Model
            m={{ ...materials, glow: materials.glow[i] }}
            moving={(el) => (moving.current[i] = el)}
          />
        </group>
      ))}
      <mesh
        ref={flash}
        material={materials.flash[weapon]}
        position={[0, 0.005, FLASH_AT[weapon]]}
        renderOrder={30}
      >
        <sphereGeometry args={[0.03, 10, 8]} />
      </mesh>
    </group>
  );
};

export default Viewmodel;
