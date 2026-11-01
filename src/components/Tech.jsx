import { m } from 'framer-motion';

import { SectionWrapper } from '../hoc';
import { techGroups, technologies } from '../constans';
import { reveal, staggerContainer } from '../utils/motion';
import { requestFrames } from './canvas/viewPresence';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import SectionHeader from './SectionHeader';
import Spotlight from './Spotlight';
import { useI18n } from '../i18n/context';
import { Ball, SceneView } from './canvas';

// The bento: on large screens a 6-column grid, the large card a full-width row (its text left,
// its balls right, nothing left empty), then the two medium cards side by side and the three
// tools in a row below; on tablets 2 columns
const SPAN = {
  large: 'sm:col-span-2 lg:col-span-6',
  medium: 'sm:col-span-2 lg:col-span-3',
  small: 'lg:col-span-2 sm:last:col-span-2 lg:last:col-span-2',
};
// Each ball's 3D view, by card size
const BALL = {
  // Three must fit one row of the card on a 360px phone; from sm the card is wide enough at full size
  large: 'h-18 w-18 xs:h-24 xs:w-24 sm:h-32 sm:w-32',
  medium: 'h-18 w-18 xs:h-20 xs:w-20 sm:h-24 sm:w-24',
  small: 'h-16 w-16 sm:h-20 sm:w-20',
};
const CARD = 'card-glass relative flex';
// A card's reveal spring settles within a second; the 3D layer redraws meanwhile
const followReveal = () => requestFrames(1200);

const TechBall = ({ tech, size, warmUp }) => (
  // The visible name labels the ball, so the 3D view itself is decorative
  <SceneView
    sectionType='ball'
    className={`flex shrink-0 items-center justify-center ${BALL[size]}`}
    fallback={<img src={tech.icon} alt='' className='h-1/2 w-1/2 object-contain' />}
  >
    <Ball imgUrl={tech.icon} warmUp={warmUp} />
  </SceneView>
);

const Tech = () => {
  const { t } = useI18n();
  const first = technologies[0];
  // Under reduced motion the cards only fade, so the 3D layer has nothing to follow
  const follow = usePrefersReducedMotion() ? undefined : followReveal;
  return (
    <>
      <SectionHeader id='tech' title={t('tech.title')} lead={t('tech.lead')} />
      {/* The cards cascade in one after another (0.1 s apart), each on the reveal spring; a card's
          balls ride along, the 3D layer drawing every frame while it moves (requestFrames) */}
      <m.ul
        variants={staggerContainer(0.1)}
        className='mt-12 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-6'
      >
        {techGroups.map(({ id, size }) => {
          const tools = technologies.filter((tech) => tech.group === id);
          const title = t(`tech.groups.${id}.title`);
          const text = t(`tech.groups.${id}.text`);
          if (size === 'small') {
            const [tech] = tools;
            return (
              <m.li
                key={id}
                variants={reveal()}
                onAnimationStart={follow}
                data-spotlight
                className={`${CARD} ${SPAN.small} items-center gap-5 p-6`}
              >
                <Spotlight />
                <TechBall tech={tech} size={size} warmUp={tech === first} />
                <div>
                  <h3 className='text-lg font-bold tracking-tight text-foreground'>{title}</h3>
                  <p className='text-sm text-foreground-muted'>{text}</p>
                </div>
              </m.li>
            );
          }
          const large = size === 'large';
          return (
            <m.li
              key={id}
              variants={reveal()}
              onAnimationStart={follow}
              data-spotlight
              className={`${CARD} ${SPAN[size]} flex-col`}
            >
              <Spotlight />
              {/* A console tab over the card: its path and how many tools it holds */}
              <div
                aria-hidden='true'
                className='flex items-center justify-between border-b border-line px-6 py-3 font-mono text-xs text-foreground-muted sm:px-8'
              >
                <span>~/stack/{id}</span>
                <span className={large ? 'text-secondary' : undefined}>
                  {t('tech.tools', { count: tools.length })}
                </span>
              </div>
              <div
                className={`blueprint flex flex-1 flex-col rounded-b-3xl p-6 sm:p-8 ${large ? 'lg:flex-row lg:items-center lg:justify-between lg:gap-10' : ''}`}
              >
                <div>
                  <h3 className='text-h3 font-bold text-foreground'>{title}</h3>
                  <p className='mt-2 max-w-md text-foreground-muted leading-relaxed'>{text}</p>
                </div>
                <ul
                  className={`flex list-none flex-wrap gap-x-4 gap-y-4 pt-8 xs:gap-x-6 ${large ? 'justify-between sm:justify-start sm:gap-x-10 lg:shrink-0 lg:pt-0' : ''}`}
                >
                  {tools.map((tech) => (
                    <li key={tech.name} className='flex flex-col items-center gap-2'>
                      <TechBall tech={tech} size={size} warmUp={tech === first} />
                      <span className='text-sm font-medium text-foreground-muted'>{tech.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </m.li>
          );
        })}
      </m.ul>
    </>
  );
};

const TechSection = SectionWrapper(Tech, 'tech');

export default TechSection;
