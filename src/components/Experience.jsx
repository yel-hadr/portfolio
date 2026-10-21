import { VerticalTimeline, VerticalTimelineElement } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';

import { experiences } from '../constans';
import { SectionWrapper } from '../hoc';
import SectionHeader from './SectionHeader';

// The timeline library only takes inline styles, so read the Tailwind tokens through the
// CSS variables defined in src/index.css.
const CARD_STYLE = {
  background: 'var(--color-surface)',
  color: 'var(--color-foreground)',
  border: '1px solid var(--color-line)',
  borderRadius: '1.5rem',
  boxShadow: 'none',
  padding: '1.5rem',
};

const ExperienceCard = ({ experience }) => {
  return (
    <VerticalTimelineElement
      contentStyle={CARD_STYLE}
      contentArrowStyle={{ borderRight: '7px solid var(--color-line)' }}
      date={<span aria-hidden='true'>{experience.date}</span>}
      dateClassName='!text-foreground-muted !opacity-100 font-medium'
      iconStyle={{
        background: experience.iconBg,
        boxShadow: '0 0 0 4px var(--color-background), 0 0 0 5px var(--color-line)',
      }}
    >
      <h3 className='text-foreground text-xl sm:text-2xl font-bold'>{experience.title}</h3>
      {/* The visible date renders after the card content; give screen readers it in reading order */}
      <p className='sr-only'>{experience.date}</p>
      {experience.company_name && (
        <p className='text-foreground-muted font-semibold !m-0'>{experience.company_name}</p>
      )}
      <ul className='mt-4 list-disc ml-5 space-y-2'>
        {experience.points.map((point) => (
          <li
            key={point}
            className='text-foreground-muted text-sm sm:text-base !font-normal leading-relaxed pl-1'
          >
            {point}
          </li>
        ))}
      </ul>
    </VerticalTimelineElement>
  );
};

const Experience = () => {
  return (
    <>
      <SectionHeader
        id='experience'
        title='1337 Experience.'
        lead="What I've done so far as a 1337 student."
      />
      <div className='mt-12 flex flex-col'>
        {/* animate={false}: entries stay visible instead of popping in on scroll */}
        <VerticalTimeline animate={false} lineColor='rgb(255 255 255 / 0.1)'>
          {experiences.map((experience) => (
            <ExperienceCard key={experience.title} experience={experience} />
          ))}
        </VerticalTimeline>
      </div>
    </>
  );
};

const ExperienceSection = SectionWrapper(Experience, 'experience');

export default ExperienceSection;
