import { motion } from 'framer-motion';

import { styles } from '../styles';
import { person, services } from '../constans';
import { SectionWrapper } from '../hoc';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';

const ServiceItem = ({ title, icon }) => (
  <li className='flex items-center gap-4 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0'>
    <img src={icon} alt='' className='h-10 w-10 shrink-0' />
    <span className='text-lg font-semibold text-foreground'>{title}</span>
  </li>
);

const About = () => (
  <>
    <SectionHeader id='about' title='About me.' />
    <div className='mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-16'>
      <motion.p variants={reveal()} className={`${styles.body} max-w-prose sm:text-lg`}>
        {person.summary}
      </motion.p>

      <motion.div variants={reveal(0.1)} className={styles.card}>
        <h3 className='mb-6 text-xl font-bold text-foreground'>What I do</h3>
        <ul>
          {services.map((service) => (
            <ServiceItem key={service.title} {...service} />
          ))}
        </ul>
      </motion.div>
    </div>
  </>
);

const AboutSection = SectionWrapper(About, 'about');

export default AboutSection;
