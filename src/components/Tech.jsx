import { motion } from 'framer-motion';

import { SectionWrapper } from '../hoc';
import { technologies } from '../constans';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import { Ball, SceneView } from './canvas';

const Tech = () => {
  return (
    <>
      <SectionHeader
        id='tech'
        title='Tech stack.'
        lead='Cloud, infrastructure and the languages I build with.'
      />
      <motion.ul
        variants={reveal()}
        className='mt-12 flex flex-wrap justify-center gap-x-6 gap-y-8 sm:gap-x-10'
      >
        {technologies.map((tech, i) => (
          <li key={tech.name} className='flex w-24 flex-col items-center gap-2 sm:w-28'>
            {/* The visible name below labels the ball, so the 3D view itself is decorative */}
            <SceneView
              sectionType='ball'
              className='flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28'
              fallback={<img src={tech.icon} alt='' className='h-14 w-14 object-contain' />}
            >
              <Ball imgUrl={tech.icon} warmUp={i === 0} />
            </SceneView>
            <span className='text-sm font-medium text-foreground-muted'>{tech.name}</span>
          </li>
        ))}
      </motion.ul>
    </>
  );
};

const TechSection = SectionWrapper(Tech, 'tech');

export default TechSection;
