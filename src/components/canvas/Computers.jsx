import { Suspense, useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls , Preload, useGLTF } from "@react-three/drei"


import CanvasLoeder from "../Loader"
const Computers = ({ isMobile }) => {
  const computer = useGLTF("./desktop_pc/scene.gltf") 

  return (
    <mesh>
      <hemisphereLight intensity={0.8}
      groundColor='black' />
      <pointLight intensity={1}/>
      <spotLight 
        position={[-20, 50, 10]}
        angle={0.12}
        penumbra={1}
        intensity={1}
        castShadow                      
        shadow-mapSize={1024}
      />
      <primitive object={computer.scene} 
        scale={ isMobile ? 0.5 : 0.75}
        position={isMobile ?[0,-3,-1.5] :[0, -2.9, -1.5]}
        rotation={[0, -0.1, -0.1]}
      />
    </mesh>
  )
}

const ComputersCanvas = () => {
  // Check if the user is on a mobile device

  // first we need to import the useState and useEffect hooks from react
  // then we create a state variable called isMobile and a function called setIsMobile
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // we create a constant called mediaQuery and we use the window.matchMedia method to check if the user's screen is less than 768px
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    // we set the isMobile state to the result of the mediaQuery.matches
    setIsMobile(mediaQuery.matches);

    // we create a function called handler that takes an event as an argument
    const handler = (e) => setIsMobile(e.matches);

    // we add an event listener to the mediaQuery that listens for changes and calls the handler function
    mediaQuery.addEventListener('change', handler);

    // we return a function that removes the event listener when the component is unmounted
    return () => mediaQuery.removeEventListener('change', handler);
  })
  return (
    <Canvas
      frameloop="demand"
      shadows
      camera={{ position: [20, 3, 5], fov: 25 }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <Suspense fallback={<CanvasLoeder />}>
        <OrbitControls
          enableZoom={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
        />
        <Computers  isMobile={isMobile} />
      </Suspense>

      <Preload all />
    </Canvas>
  )
}
export default ComputersCanvas