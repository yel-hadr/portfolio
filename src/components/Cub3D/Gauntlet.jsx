import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  CylinderGeometry,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { toColor } from './toColor';

// Game Mode's weapon as a 3D viewmodel in the camera's lower right: a "Data Purger" gauntlet with
// glowing coils around its barrel, a drum that spins up on each shot, vents, and a muzzle flash.
// One frame, three tunings (the weapons in rooms.js): the Kar98k a long rail, the Tactical a
// short one, the Defender a wide muzzle. Drawn over the world (no depth test), so it never sinks
// into a wall the player stands against.

const VARIANTS = [
  { color: 'info', barrel: 0.3, radius: 0.016, coils: 3 },
  { color: 'success', barrel: 0.15, radius: 0.014, coils: 2 },
  { color: 'primary', barrel: 0.17, radius: 0.03, coils: 4 },
];
// In view: at 0.3 ahead the frustum spans about 0.17 to each side and 0.1 up and down
const BASE = [0.118, -0.088, -0.28];
const SCALE = 0.5;
// Turned in toward the crosshair and tipped a little, as a viewmodel is
const AIM = [-0.06, 0.16, 0];
// Drawn over the world without a depth test, and marked transparent (at full opacity) so three
// draws it in the transparent pass, after the world's own transparent objects (the beam, labels,
// trails, lasers, dust), sorted last by its high renderOrder: nothing ever shows through it
const OVER = { depthTest: false, depthWrite: false, transparent: true };

// The parts' shapes, shared by every tuning
const GEOMETRY = {
  body: new BoxGeometry(0.075, 0.07, 0.26),
  grip: new BoxGeometry(0.05, 0.11, 0.06),
  trim: new BoxGeometry(0.08, 0.012, 0.2),
  drum: new CylinderGeometry(0.038, 0.038, 0.05, 12),
  coil: new TorusGeometry(0.03, 0.0045, 6, 18),
  vent: new BoxGeometry(0.004, 0.012, 0.05),
  flash: new SphereGeometry(0.03, 10, 8),
};

/**
 * @param weapon  index into VARIANTS (the weapon in hand)
 * @param motion  Cub3DWorld's shared ref: recoil (set by a shot), bob and sway (from GameMotion)
 * @param colors  theme channels: { dark, muted, info, success, primary }
 */
const Gauntlet = ({ weapon, motion, reduced, noFlash, flat, colors }) => {
  const group = useRef(null);
  const drum = useRef(null);
  const flash = useRef(null);
  const spin = useRef(0);
  const variant = VARIANTS[weapon];

  const materials = useMemo(() => {
    const color = (name, k = 1) => toColor(colors[name], k);
    const glow = flat ? color(variant.color) : color(variant.color, 3);
    const made = {
      metal: flat
        ? new MeshBasicMaterial({ color: color('muted'), ...OVER })
        : new MeshStandardMaterial({
            color: color('muted', 0.9),
            metalness: 0.7,
            roughness: 0.35,
            emissive: color('muted', 0.18),
            ...OVER,
          }),
      dark: flat
        ? new MeshBasicMaterial({ color: color('dark'), ...OVER })
        : new MeshStandardMaterial({
            color: color('muted', 0.35),
            emissive: color('muted', 0.06),
            metalness: 0.6,
            roughness: 0.5,
            ...OVER,
          }),
      glow: new MeshBasicMaterial({ color: glow, toneMapped: false, ...OVER }),
      flash: new MeshBasicMaterial({
        color: glow,
        toneMapped: false,
        transparent: true,
        opacity: 0,
        ...OVER,
      }),
    };
    return made;
  }, [colors, flat, variant.color]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    const m = motion.current;
    const recoil = m.recoil ?? 0;
    if (reduced) {
      g.position.set(...BASE);
      g.rotation.set(...AIM);
    } else {
      const bx = m.bobX ?? 0;
      const by = m.bobY ?? 0;
      g.position.set(
        BASE[0] + bx * 0.012 + (m.sway ?? 0) * 0.03,
        BASE[1] + by * 0.01 - recoil * 0.018,
        BASE[2] + recoil * 0.07
      );
      g.rotation.set(AIM[0] + recoil * 0.28, AIM[1] + (m.sway ?? 0) * 0.08, -recoil * 0.05);
    }
    // The drum spins up with each shot and winds down
    spin.current = MathUtils.damp(spin.current, 0, 2.5, dt) + recoil * dt * 60;
    if (drum.current && !reduced) drum.current.rotation.y += (1 + spin.current) * dt;
    // The muzzle flash: `flash`, set by a shot at most three times a second (WCAG 2.3.1, however
    // fast the pistol fires), eased out here; none with reduced motion or Reduce flashing
    m.flash = MathUtils.damp(m.flash ?? 0, 0, 12, dt);
    const burst = reduced || noFlash ? 0 : m.flash;
    if (flash.current) {
      flash.current.material.opacity = burst;
      flash.current.scale.setScalar(0.6 + burst * 1.4);
    }
    // No light of its own (every lit pixel would pay for it): the metal glows with the flash
    if (!flat) materials.metal.emissiveIntensity = 1 + burst * 5;
  });

  const tip = -0.13 - variant.barrel;
  return (
    <group ref={group} position={BASE} scale={SCALE} renderOrder={20}>
      <mesh geometry={GEOMETRY.body} material={materials.metal} renderOrder={20} />
      <mesh
        geometry={GEOMETRY.grip}
        material={materials.dark}
        position={[0, -0.07, 0.07]}
        rotation={[0.25, 0, 0]}
        renderOrder={19}
      />
      <mesh
        geometry={GEOMETRY.trim}
        material={materials.dark}
        position={[0, 0.04, -0.01]}
        renderOrder={21}
      />
      <mesh
        ref={drum}
        geometry={GEOMETRY.drum}
        material={materials.dark}
        position={[-0.045, 0.005, 0.02]}
        rotation={[0, 0, Math.PI / 2]}
        renderOrder={21}
      />
      {/* The barrel along -z, with its coils */}
      <mesh
        material={materials.dark}
        position={[0, 0.005, -0.13 - variant.barrel / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={22}
      >
        <cylinderGeometry args={[variant.radius, variant.radius * 1.15, variant.barrel, 12]} />
      </mesh>
      {Array.from({ length: variant.coils }, (_, i) => (
        <mesh
          key={i}
          geometry={GEOMETRY.coil}
          material={materials.glow}
          position={[0, 0.005, -0.15 - (i * variant.barrel * 0.8) / variant.coils]}
          scale={(variant.radius + 0.012) / 0.03}
          renderOrder={23}
        />
      ))}
      {/* Glowing vents along the body's side */}
      {[0.06, 0.0, -0.06].map((z) => (
        <mesh
          key={z}
          geometry={GEOMETRY.vent}
          material={materials.glow}
          position={[0.039, 0.01, z]}
          renderOrder={23}
        />
      ))}
      <mesh
        ref={flash}
        geometry={GEOMETRY.flash}
        material={materials.flash}
        position={[0, 0.005, tip - 0.02]}
        renderOrder={24}
      />
    </group>
  );
};

export default Gauntlet;
