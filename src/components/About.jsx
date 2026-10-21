import { motion } from 'framer-motion';

import { styles } from '../styles';
import { services } from '../constans';
import { SectionWrapper } from '../hoc';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import ResumeLink from './ResumeLink';
import { useI18n } from '../i18n/context';

const ServiceItem = ({ title, icon }) => (
  <li className='flex items-center gap-4 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0'>
    <img src={icon} alt='' className='h-10 w-10 shrink-0' />
    <span className='text-lg font-semibold text-foreground'>{title}</span>
  </li>
);

const About = () => {
  const { t } = useI18n();
  return (
    <>
      <SectionHeader id='about' title={t('about.title')} />
      <div className='mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-16'>
        <motion.div variants={reveal()}>
          <p className={`${styles.body} max-w-prose sm:text-lg`}>{t('person.summary')}</p>
          <ResumeLink className='mt-8' />
        </motion.div>

        <motion.div variants={reveal(0.1)} className={styles.card}>
          <h3 className='mb-6 text-xl font-bold text-foreground'>{t('about.whatIDo')}</h3>
          <ul>
            {services.map((service) => (
              <ServiceItem
                key={service.id}
                icon={service.icon}
                title={t(`about.services.${service.id}`)}
              />
            ))}
          </ul>
        </motion.div>
      </div>
    </>
  );
};

const AboutSection = SectionWrapper(About, 'about');

export default AboutSection;
