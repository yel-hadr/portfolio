import { m } from 'framer-motion';

import { styles } from '../styles';
import { education } from '../constans';
import { SectionWrapper } from '../hoc';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import { useI18n } from '../i18n/context';

// `wide`: the only entry, across the page with two columns from md (the school, degree and dates
// on the left, the curriculum on the right), so neither half of the page is left empty
const EducationCard = ({ school, degree, date, points, wide }) => (
  <m.li
    variants={reveal()}
    className={`${styles.card} flex flex-col ${wide ? 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10' : ''}`}
  >
    <div>
      <h3 className='text-2xl font-bold text-foreground'>{school}</h3>
      <p className='mt-1 font-semibold text-primary-400'>{degree}</p>
      {date && <p className='mt-1 text-sm font-medium text-foreground-muted'>{date}</p>}
    </div>
    {points.length > 0 && (
      <ul className={`mt-4 space-y-2 ${wide ? 'md:mt-0' : ''}`}>
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
      {/* Two columns from md when there is more than one entry; a single card spans the page with
          its two columns inside */}
      <ul className={`mt-10 grid gap-8 ${education.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {education.map((entry) => (
          <EducationCard
            key={entry.id}
            school={t(`education.items.${entry.id}.school`)}
            degree={t(`education.items.${entry.id}.degree`)}
            date={t(`education.items.${entry.id}.date`)}
            points={t(`education.items.${entry.id}.points`)}
            wide={education.length === 1}
          />
        ))}
      </ul>
    </>
  );
};

const EducationSection = SectionWrapper(Education, 'education');

export default EducationSection;
