import React from 'react'
import { motion } from 'framer-motion'
import { Tilt } from 'react-tilt'

import { fadeIn, textVariant } from '../utils/motion'

import { styles } from '../styles'
import { services } from '../constans'
import { SectionWrapper } from '../hoc'

const ServiceCard = ({ index, title, icon }) => {
  return (
    <Tilt
      className="xs:w-[250px] w-full">
      <motion.div
        variants={fadeIn('right', 'spring', 0.5 * index, 1)}
        className='w-full orange-pink-gradient p-[1px] rounded-[20px] shadow-card'
      >
        <div 
          options={{ max: 45, scale: 1 , speed: 450 }}
          className='bg-tertiary rounded-[20px] px-12 py-5 min-h-[280px] flex flex-col items-center justify-evenly'
          >
          <img src={icon} alt={title} className='w-16 h-16' />
          <h3 className='text-white text-[20px] font-bold text-center'>{title}</h3>

          </div>
      </motion.div>

    </Tilt>
  )
}

const About = () => {
  
  return (
    <>
      <motion.div variants={textVariant()} >
        <p className={styles.sectionSubText}>Introdtion</p>
        <h2 className={styles.sectionHeadText}>Overview.</h2>
      </motion.div>
      <motion.p variants={fadeIn('', '', 0.1, 1)}
        className='mt-4 text-secondary text-[17px] max-w-5xl leading-[30px]'
      
        >I'm a passionate software developer with expertise in <strong>C/C++</strong>, <strong>JavaScript</strong>, and <strong>Python</strong>, and hands-on experience with frameworks like <strong>Django</strong> and <strong>React</strong>.<br/> Skilled in <strong>system administration</strong>, <strong>Docker</strong>, and <strong>UNIX environments</strong>, I thrive on building scalable and efficient solutions. A quick learner and team player, I'm excited to tackle real-world challenges and deliver impactful results. Let's create something extraordinary together!
      </motion.p>
      <div
        className='mt-20 flex flex-wrap justify-center gap-8'
        >
          {services.map((service, index) => (
            <ServiceCard key={service.title} index={index} {...service} />
          ))}
      </div>
    </>
  )
}

export default SectionWrapper(About, 'about')