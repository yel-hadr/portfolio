import { motion } from 'framer-motion';

import { styles } from '../styles';
import { services } from '../constans';
import { SectionWrapper } from '../hoc';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import { Earth, SceneView } from './canvas';

const Em = ({ children }) => <strong className='text-foreground font-semibold'>{children}</strong>;

// Roles as a quiet spec list: hairline-separated rows, no boxed cards.
const ServiceItem = ({ title, icon }) => (
  <motion.li variants={reveal()} className='flex items-center gap-4 border-t border-line pt-6'>
    <img src={icon} alt='' className='h-12 w-12 shrink-0' />
    <h3 className='text-foreground text-lg font-semibold'>{title}</h3>
  </motion.li>
);

const About = () => {
  // The globe sits beside the overview on wide screens only; on phones Contact has the globe.
  const showGlobe = useMediaQuery('(min-width: 1024px)');

  return (
    <>
      <div className='lg:grid lg:grid-cols-[1fr_360px] lg:items-center lg:gap-12'>
        <div>
          <SectionHeader id='about' title='Overview.' />
          <motion.p variants={reveal()} className={`${styles.body} mt-6 sm:text-lg max-w-prose`}>
            I&apos;m a passionate software developer with expertise in <Em>C/C++</Em>,{' '}
            <Em>JavaScript</Em>, and <Em>Python</Em>, and hands-on experience with frameworks like{' '}
            <Em>Django</Em> and <Em>React</Em>. Skilled in <Em>system administration</Em>,{' '}
            <Em>Docker</Em>, and <Em>UNIX environments</Em>, I thrive on building scalable and
            efficient solutions. A quick learner and team player, I&apos;m excited to tackle
            real-world challenges and deliver impactful results. Let&apos;s create something
            extraordinary together!
          </motion.p>
        </div>
        {showGlobe && (
          <SceneView sectionType='earth' className='h-[360px] w-full'>
            <Earth />
          </SceneView>
        )}
      </div>

      <ul className='mt-12 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4'>
        {services.map((service) => (
          <ServiceItem key={service.title} {...service} />
        ))}
      </ul>
    </>
  );
};

const AboutSection = SectionWrapper(About, 'about');

export default AboutSection;
