import { useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as random from "maath/random/dist/maath-random.esm";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { ViewCamera } from "./helpers";

const STAR_CONFIG = {
  COUNT: 1700, // stars; the position buffer holds COUNT * 3 floats
  SIZE: 0.002,
  RADIUS: 1.2,
  ROTATION_SPEED_X: 0.1,
  ROTATION_SPEED_Y: 0.067,
};

const Stars = () => {
  const ref = useRef();
  const reduced = usePrefersReducedMotion();
  const [sphere] = useState(() =>
    random.inSphere(new Float32Array(STAR_CONFIG.COUNT * 3), { radius: STAR_CONFIG.RADIUS })
  );

  useFrame((state, delta) => {
    if (reduced || !ref.current) return;
    ref.current.rotation.x -= Math.min(delta, 0.1) * STAR_CONFIG.ROTATION_SPEED_X;
    ref.current.rotation.y -= Math.min(delta, 0.1) * STAR_CONFIG.ROTATION_SPEED_Y;
  });

  return (
    <>
      <ViewCamera position={[0, 0, 1]} fov={75} />
      <group rotation={[0, 0, Math.PI / 4]}>
        <Points ref={ref} positions={sphere} stride={3} frustumCulled>
          <PointMaterial
            transparent
            color="#f272c8"
            size={STAR_CONFIG.SIZE}
            sizeAttenuation
            // Stars draw first and nothing clears depth between Views (drei sets
            // autoClear=false), so they must not write depth or they could hide later views.
            depthWrite={false}
          />
        </Points>
      </group>
    </>
  );
};

export default Stars;
