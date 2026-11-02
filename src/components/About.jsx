import { m } from 'framer-motion';

import { styles } from '../styles';
import { services } from '../constans';
import { SectionWrapper } from '../hoc';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import ResumeLink from './ResumeLink';
import { useI18n } from '../i18n/context';
import Spotlight from './Spotlight';
import { ActivityIcon, CloudIcon, GitBranchIcon, ServerIcon } from './icons';

// One line icon per service, in the page's own orange (they replaced four glossy renders whose
// teal and purple matched nothing else on the page)
const SERVICE_ICONS = {
  backend: ServerIcon,
  cloud: CloudIcon,
  devops: GitBranchIcon,
  automation: ActivityIcon,
};

const ServiceItem = ({ id, title }) => {
  const Icon = SERVICE_ICONS[id];
  return (
    <li className='flex items-center gap-4 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0'>
      <span className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised text-primary-400'>
        <Icon className='h-5 w-5' />
      </span>
      <span className='text-lg font-semibold text-foreground'>{title}</span>
    </li>
  );
};

const About = () => {
  const { t } = useI18n();
  return (
    <>
      <SectionHeader id='about' title={t('about.title')} />
      <div className='mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-16'>
        <m.div variants={reveal()}>
          <p className={`${styles.body} max-w-prose sm:text-lg sm:leading-7`}>
            {t('person.summary')}
          </p>
          <ResumeLink className='mt-8' />
        </m.div>

        <m.div variants={reveal(0.1)} data-spotlight className={`${styles.card} relative`}>
          <Spotlight />
          <h3 className='mb-6 text-xl font-bold text-foreground'>{t('about.whatIDo')}</h3>
          <ul>
            {services.map((service) => (
              <ServiceItem
                key={service.id}
                id={service.id}
                title={t(`about.services.${service.id}`)}
              />
            ))}
          </ul>
        </m.div>
      </div>
    </>
  );
};

const AboutSection = SectionWrapper(About, 'about');

export default AboutSection;
