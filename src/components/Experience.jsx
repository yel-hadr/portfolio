import { VerticalTimeline, VerticalTimelineElement } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';

import { experiences } from '../constans';
import { SectionWrapper } from '../hoc';
import SectionHeader from './SectionHeader';
import Spotlight from './Spotlight';
import { useI18n } from '../i18n/context';

// The timeline library only takes inline styles, so read the Tailwind tokens through the
// CSS variables defined in src/index.css.
const CARD_STYLE = {
  background: 'var(--color-glass)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  color: 'var(--color-foreground)',
  border: '1px solid var(--color-line)',
  borderRadius: '1.5rem',
  boxShadow: 'var(--shadow-card)',
  padding: '1.5rem',
};

const ExperienceCard = ({ experience }) => {
  const { t } = useI18n();
  const title = t(`experience.items.${experience.id}.title`);
  const points = t(`experience.items.${experience.id}.points`);
  const date = t(`experience.items.${experience.id}.date`);
  return (
    <VerticalTimelineElement
      contentStyle={CARD_STYLE}
      contentArrowStyle={{ borderRight: '7px solid var(--color-line)' }}
      date={date ? <span aria-hidden='true'>{date}</span> : undefined}
      dateClassName='!text-foreground-muted !opacity-100 font-medium'
      iconStyle={{
        background: experience.iconBg,
        boxShadow: '0 0 0 4px var(--color-background), 0 0 0 5px var(--color-rule)',
      }}
    >
      <Spotlight />
      <h3 className='text-foreground text-xl sm:text-2xl font-bold'>{title}</h3>
      {/* The visible date renders after the card content; give screen readers it in reading order */}
      {date && <p className='sr-only'>{date}</p>}
      {experience.company_name && (
        <p className='text-primary-400 font-semibold !m-0'>{experience.company_name}</p>
      )}
      <ul className='mt-4 list-disc ml-5 space-y-2'>
        {points.map((point) => (
          <li
            key={point}
            className='text-foreground-muted text-sm sm:text-base !font-normal leading-relaxed sm:leading-6 pl-1'
          >
            {point}
          </li>
        ))}
      </ul>
    </VerticalTimelineElement>
  );
};

const Experience = () => {
  const { t } = useI18n();
  return (
    <>
      <SectionHeader id='experience' title={t('experience.title')} lead={t('experience.lead')} />
      <div className='mt-12 flex flex-col'>
        {/* animate={false}: entries stay visible instead of popping in on scroll */}
        <VerticalTimeline animate={false} lineColor='var(--color-rule)'>
          {experiences.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
        </VerticalTimeline>
      </div>
    </>
  );
};

const ExperienceSection = SectionWrapper(Experience, 'experience');

export default ExperienceSection;
