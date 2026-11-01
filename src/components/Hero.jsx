import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';

import { styles } from '../styles';
import { profile320, profile640 } from '../assets';
import { person } from '../constans';
import { pressable, reveal, staggerContainer, wordReveal } from '../utils/motion';
import { useStillMotion } from '../hooks/useMotionPaused';
import Magnetic from './Magnetic';
import ResumeLink from './ResumeLink';
import { CrosshairIcon } from './icons';
import { useI18n } from '../i18n/context';

// The portrait drifts at a fifth of the scroll speed (it trails the text), only while the hero is
// on screen
const PARALLAX = 0.2;

const Hero = ({ onEnterGame }) => {
  const { t } = useI18n();
  const still = useStillMotion();
  const depth = useRef(null);
  // will-change only while the name's words are rising, then released
  const [settled, setSettled] = useState(false);

  // Hero parallax: a passive scroll listener writes a transform, at most once a frame; no React
  // render. Off under reduced motion or the pause switch, and past the hero
  useEffect(() => {
    const el = depth.current;
    if (!el || still) return undefined;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = window.scrollY;
      if (y > window.innerHeight * 1.2) return;
      el.style.transform = `translate3d(0, ${(y * PARALLAX).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      el.style.transform = '';
    };
  }, [still]);

  return (
    <section
      id='hero'
      aria-labelledby='hero-title'
      // As tall as its content, not a screen: About's heading is in view under it, so the page reads
      // on instead of a wide empty band under the buttons
      className='relative flex w-full items-center'
    >
      {/* The page's one orchestrated entrance: portrait, name, headline, then the actions. */}
      <m.div
        variants={staggerContainer(0.12, 0.1)}
        initial='hidden'
        animate='show'
        // Two columns from md (a tablet has room beside the name); on a short, wide screen (a phone
        // held sideways) a small portrait and tighter spacing keep the name and actions in view
        className={`${styles.container} grid w-full items-center gap-10 pb-16 pt-28 md:grid-cols-[1fr_auto] md:gap-10 lg:gap-16 short:grid-cols-[1fr_auto] short:gap-8 short:pb-6 short:pt-20`}
      >
        <m.figure
          variants={reveal(0, { fade: false })}
          className='relative w-40 sm:w-52 md:order-last md:w-48 lg:w-80 short:order-last short:w-28'
        >
          {/* The parallax layer (transform only) inside the figure, whose own transform is the
              entrance reveal */}
          <div ref={depth} className='relative'>
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
                sizes='(min-width: 1024px) 304px, (min-width: 768px) 176px, (min-width: 640px) 192px, 144px'
                alt={t('hero.portraitAlt')}
                width={640}
                height={800}
                fetchPriority='high'
                decoding='async'
                className='aspect-[4/5] w-full rounded-[1.25rem] object-cover'
              />
            </div>
          </div>
        </m.figure>

        <div>
          {/* The name rises word by word, each word out of its own mask (overflow hidden), then the
              alias fades up under it */}
          <m.h1
            id='hero-title'
            variants={staggerContainer(0.08)}
            onAnimationComplete={() => setSettled(true)}
            className={styles.heroHeadText}
          >
            {person.name.split(' ').map((word) => (
              <span key={word}>
                <span className='inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-bottom'>
                  <m.span
                    variants={wordReveal}
                    className={`inline-block ${settled ? '' : 'will-change-transform'}`}
                  >
                    {word}
                  </m.span>
                </span>{' '}
              </span>
            ))}
            <m.span
              variants={reveal()}
              className='mt-3 block text-2xl font-semibold tracking-normal text-foreground-muted sm:text-3xl'
            >
              ({person.alias})
            </m.span>
          </m.h1>
          <m.p variants={reveal()} className={`${styles.heroSubText} mt-6 text-pretty short:mt-3`}>
            {t('person.title')}
          </m.p>

          {/* Two buttons, the projects first, and a plain link to get in touch beside them, or under
              them where the column is too narrow. The pair never splits: stacked at one width on a
              phone, side by side from sm. Game Mode is a small dashed chip under them, a side door
              rather than a fourth call to action */}
          <m.div variants={reveal()} className='mt-10 short:mt-5'>
            <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
              <div className='grid w-full gap-3 sm:flex sm:w-auto sm:gap-4'>
                <Magnetic>
                  <m.a href='#works' className={styles.buttonPrimary} {...pressable}>
                    {t('hero.seeProjects')}
                  </m.a>
                </Magnetic>
                <Magnetic>
                  <ResumeLink />
                </Magnetic>
              </div>
              <a
                href='#contact'
                className='link-draw font-semibold text-foreground underline decoration-line-strong underline-offset-4 transition-colors before:absolute before:inset-x-0 before:-inset-y-2 hover:text-primary-400'
              >
                {t('hero.getInTouch')}
              </a>
            </div>
            <m.button
              type='button'
              aria-haspopup='dialog'
              onClick={onEnterGame}
              {...pressable}
              className='mt-6 inline-flex items-center gap-2 rounded-full border border-dashed border-primary-400 bg-glass px-4 py-1.5 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-primary/15 short:mt-3'
            >
              <CrosshairIcon className='h-4 w-4 text-primary-400' />
              {t('gameMode')}
            </m.button>
          </m.div>
        </div>
      </m.div>
    </section>
  );
};

export default Hero;
