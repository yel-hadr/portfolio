import { m } from 'framer-motion';

import { styles } from '../styles';
import { profile320, profile640 } from '../assets';
import { person } from '../constans';
import { pressable, reveal, staggerContainer } from '../utils/motion';
import Magnetic from './Magnetic';
import ResumeLink from './ResumeLink';
import { CrosshairIcon } from './icons';
import { useI18n } from '../i18n/context';

const Hero = ({ onEnterGame }) => {
  const { t } = useI18n();
  return (
    <section
      id='hero'
      aria-labelledby='hero-title'
      className='relative flex min-h-screen w-full items-center'
    >
      {/* The page's one orchestrated entrance: portrait, name, headline, then the actions. */}
      <m.div
        variants={staggerContainer(0.12, 0.1)}
        initial='hidden'
        animate='show'
        className={`${styles.container} grid w-full items-center gap-10 pb-16 pt-28 lg:grid-cols-[1fr_auto] lg:gap-16`}
      >
        <m.figure variants={reveal()} className='relative w-40 sm:w-52 lg:order-last lg:w-80'>
          {/* Soft brand glow behind the frame, dark mode only (--glow); in light the frame lifts
              off the page on a soft shadow instead */}
          <div
            aria-hidden='true'
            className='absolute -inset-6 rounded-full bg-primary/20 opacity-[var(--glow)] blur-3xl'
          />
          <div className='card-glass relative p-2 light:shadow-raised'>
            <img
              // Pre-cropped to the frame's 4:5; 320w for phones, 640w for the 304px desktop frame at 2x
              src={profile640}
              srcSet={`${profile320} 320w, ${profile640} 640w`}
              sizes='(min-width: 1024px) 304px, (min-width: 640px) 192px, 144px'
              alt={t('hero.portraitAlt')}
              width={640}
              height={800}
              // React 18 has no fetchPriority prop; the lowercase attribute passes through as-is
              // eslint-disable-next-line react/no-unknown-property
              fetchpriority='high'
              decoding='async'
              className='aspect-[4/5] w-full rounded-[1.25rem] object-cover'
            />
          </div>
        </m.figure>

        <div>
          <m.h1 id='hero-title' variants={reveal()} className={styles.heroHeadText}>
            {person.name}{' '}
            <span className='mt-3 block text-2xl font-semibold tracking-normal text-foreground-muted sm:text-3xl'>
              ({person.alias})
            </span>
          </m.h1>
          <m.p variants={reveal()} className={`${styles.heroSubText} mt-6`}>
            {t('person.title')}
          </m.p>

          {/* On a phone the calls to action stack at one width; from xs they sit in a row */}
          <m.div variants={reveal()} className='mt-10 grid gap-3 xs:flex xs:flex-wrap xs:gap-4'>
            <Magnetic>
              <m.a href='#works' className={styles.buttonPrimary} {...pressable}>
                {t('hero.seeProjects')}
              </m.a>
            </Magnetic>
            <Magnetic>
              <ResumeLink />
            </Magnetic>
            <m.a href='#contact' className={`${styles.buttonGhost} shimmer`} {...pressable}>
              {t('hero.getInTouch')}
            </m.a>
            {/* The way into Game Mode: dashed like a HUD frame, so it reads as something else */}
            <Magnetic>
              <m.button
                type='button'
                aria-haspopup='dialog'
                onClick={onEnterGame}
                {...pressable}
                className='inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-400 bg-glass px-6 py-[0.625rem] font-bold text-foreground backdrop-blur-md transition-colors hover:bg-primary/15'
              >
                <CrosshairIcon className='h-5 w-5 text-primary-400' />
                {t('gameMode')}
              </m.button>
            </Magnetic>
          </m.div>
        </div>
      </m.div>
    </section>
  );
};

export default Hero;
