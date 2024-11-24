import { Html , useProgress } from '@react-three/drei'
import { progress } from 'framer-motion'




const Loader = () => {
  const { progress } = useProgress()
  return (
    <Html>
      
      <div className="flex flex-col items-center">
        <div className="relative w-[100px] h-[100px] mt-[200px] animate-spin" style={{ transformStyle: 'preserve-3d', top: '-100px' }}>
          <div className="absolute w-full h-full bg-[#FF6500] border-2 border-white rounded shadow-[0_0_15px_#fff] animate-shiftTop" style={{ transform: 'rotateX(90deg) translateZ(50px)' }}></div>
          <div className="absolute w-full h-full bg-[#FF6500] border-2 border-white rounded shadow-[0_0_15px_#fff] animate-shiftBottom" style={{ transform: 'rotateX(-90deg) translateZ(50px)' }}></div>
          <div className="absolute w-full h-full bg-[#FF6500] border-2 border-white rounded shadow-[0_0_15px_#fff] animate-shiftRight" style={{ transform: 'rotateY(90deg) translateZ(50px)' }}></div>
          <div className="absolute w-full h-full bg-[#FF6500] border-2 border-white rounded shadow-[0_0_15px_#fff] animate-shiftLeft" style={{ transform: 'rotateY(-90deg) translateZ(50px)' }}></div>
          <div className="absolute w-full h-full bg-[#FF6500] border-2 border-white rounded shadow-[0_0_15px_#fff] animate-shiftFront" style={{ transform: 'translateZ(50px)' }}></div>
          <div className="absolute w-full h-full bg-[#FF6500] border-2 border-white rounded shadow-[0_0_15px_#fff] animate-shiftBack" style={{ transform: 'rotateY(-180deg) translateZ(50px)' }}></div>
        </div>

        <p className="text-white text-lg font-bold mt-4">{progress.toFixed(2)}%</p>
      </div>
    </Html>
  )
}

export default Loader