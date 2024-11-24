
import { motion } from 'framer-motion'
import { styles } from '../styles'
import { ComputersCanvas } from './canvas'


const Hero = () => {
  return (
    <section className='relative w-full h-screen mx-auto'>
      <div
        className={`${styles.paddingX}  absolute inset-0 top-[120px] max-w-7xl max-auto flex flex-row items-start gap-5`}>
          
          <div className='flex flex-col justify-center items-center mt-5'>
            
            <div className='w-5 h-5 rounded-full bg-[#FF6500]' />
            <div className='w-1 sm:h-80 h-40 orange-gradient' />
            
          </div>
          <div>
            <h1 className={`${styles.heroHeadText} text-white`}>
              Hi , I'm <span className='text-[#FF6500]'>Youssef</span>
            </h1>
            <p className={`${styles.heroSubText} mt-4`}>
              I'm software engineering student at UM6P-1337, <br className='sm:block hidden'/>
              strong foundation in developing efficient and scalable software solutions.
            </p>
          </div>
      </div>
      <ComputersCanvas />
      <div
        className='absolute xs:bottom-10 bottom-10 w-full flex justify-center items-center'
      >
        <a href='#about'>
          <div className=' w-[35px] h-[64px] rounded-3xl flex justify-center items-start border-secondary border-4 p-2'
          >
            <motion.div
              animate={{
                y: [0, 24, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: 'loop',
              }} 
              className='w-3 h-3 bg-secondary rounded-full mb-1'
            />
          </div>

        </a>

      </div>

    </section>
  )
}

export default Hero