import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";

import { AutoRotate, ViewCamera } from "./helpers";

const MODEL = "./planet/scene.gltf";

const Earth = () => {
  const { scene } = useGLTF(MODEL);
  // useGLTF returns one cached scene; an Object3D can only have one parent, so every
  // mounted Earth (About and Contact) needs its own clone. Geometry and materials stay shared.
  const earth = useMemo(() => scene.clone(), [scene]);

  return (
    <>
      <ViewCamera position={[-4.33, 0, 6.5]} fov={45} near={0.1} far={200} />
      <AutoRotate speed={0.1}>
        <primitive object={earth} scale={2.5} />
      </AutoRotate>
    </>
  );
};

useGLTF.preload(MODEL);

export default Earth;
