import { m } from 'framer-motion';

import { styles } from '../styles';
import { education } from '../constans';
import { SectionWrapper } from '../hoc';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import { useI18n } from '../i18n/context';

const EducationCard = ({ school, degree, date, points }) => (
  <m.li variants={reveal()} className={`${styles.card} flex flex-col`}>
    <h3 className='text-2xl font-bold text-foreground'>{school}</h3>
    <p className='mt-1 font-semibold text-primary-400'>{degree}</p>
    {date && <p className='mt-1 text-sm font-medium text-foreground-muted'>{date}</p>}
    {points.length > 0 && (
      <ul className='mt-4 space-y-2'>
        {points.map((point) => (
          <li key={point} className={styles.body}>
            {point}
          </li>
        ))}
      </ul>
    )}
  </m.li>
);

const Education = () => {
  const { t } = useI18n();
  return (
    <>
      <SectionHeader id='education' title={t('education.title')} />
      {/* Two columns from md when there is more than one entry; a single card keeps a readable
          line length instead of stretching across the page */}
      <ul className={`mt-10 grid gap-8 ${education.length > 1 ? 'md:grid-cols-2' : 'max-w-3xl'}`}>
        {education.map((entry) => (
          <EducationCard
            key={entry.id}
            school={t(`education.items.${entry.id}.school`)}
            degree={t(`education.items.${entry.id}.degree`)}
            date={t(`education.items.${entry.id}.date`)}
            points={t(`education.items.${entry.id}.points`)}
          />
        ))}
      </ul>
    </>
  );
};

const EducationSection = SectionWrapper(Education, 'education');

export default EducationSection;
