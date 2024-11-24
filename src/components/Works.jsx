import React from 'react'
import { motion } from 'framer-motion'

import { styles } from '../styles'
import { github } from '../assets'
import { SectionWrapper } from '../hoc'
import { projects } from '../constans'
import { fadeIn, textVariant } from '../utils/motion'
import { Tilt } from 'react-tilt'


const ProjectCard = ({ index, name, description, tags, image, source_code_link }) => {
  return (
    <motion.div variants={ fadeIn("up", "spring", index * 0.5, 0.75)}>
      <Tilt
        options={{
          max: 45,
          scale: 1,
          speed : 450,
        }}
        className='bg-tertiary rounded-2xl sm:w-[360px] w-full p-5'
      >
        <div
          className='relative w-full h-[230px]'
          >
            <img src={image}
              alt={name}
              className='w-full h-full object-cover rounded-2xl'
            />
            <div className='absolute inset-0 flex justify-end m-3 card-img_hover'
              >
                <div
                  onClick={() => window.open(source_code_link, "_blank")} 
                  className='w-10 h-10 black-gradient rounded-full flex justify-center items-center cursor-pointer'
                  >
                    <img 
                      src={github}
                      alt='github'
                      className='w-1/2 h-1/2'
                      />
                </div>
            </div>
        </div>
        <div className='mt-5'>
          <h3 className='text-white text-xl font-bold'>{name}</h3>
          <p className='text-secondary mt-2'>{description}</p>
          <div className='flex flex-wrap gap-2 mt-3'>
            {tags.map((tag, index) => (
                <span key={`tag-${index}`}
                  className={`px-2 py-1 rounded-md ${tag.color}`}
                  >
                    #{tag.name}
                </span>
              ))}
          </div>
        </div>

      </Tilt>
    </motion.div>
  )
}

const Works = () => {
  return (
    <>
      <motion.div variants={textVariant()} >
          <p className={styles.sectionSubText}>My Work</p>
          <h2 className={styles.sectionHeadText}>Projects.</h2>
      </motion.div>
      <div>
        <motion.p
          variants={fadeIn("", "", 0.1, 1)}
          className='mt-3 text-secondary text-[17px] max-w-3xl leading-[30px]'
          >
            Following projects showcases my skills and experience through real-world examples of my work. Each project is briefly described with links to code repositories. It reflects my ability to solve complex problems, work with different technologies, and manage projects effectively.
        </motion.p>
      </div>
      <div className='mt-20 flex flex-wrap gap-7'>
        {projects.map((project, index) => (
            <ProjectCard key={`project-${index}`} index={index} {...project} />
          ))}
      </div>

    </>
  )
}

export default SectionWrapper(Works, 'works')