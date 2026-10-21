import { motion } from 'framer-motion';

import { styles } from '../styles';
import { profile } from '../assets';
import { person } from '../constans';
import { reveal, staggerContainer } from '../utils/motion';

const Hero = () => {
  return (
    <section
      id='hero'
      aria-labelledby='hero-title'
      className='relative flex min-h-screen w-full items-center'
    >
      {/* The page's one orchestrated entrance: portrait, name, headline, then the actions. */}
      <motion.div
        variants={staggerContainer(0.12, 0.1)}
        initial='hidden'
        animate='show'
        className={`${styles.container} grid w-full items-center gap-10 pb-16 pt-28 lg:grid-cols-[1fr_auto] lg:gap-16`}
      >
        <motion.figure variants={reveal()} className='relative w-40 sm:w-52 lg:order-last lg:w-80'>
          {/* Soft brand glow behind the frame */}
          <div
            aria-hidden='true'
            className='absolute -inset-6 rounded-full bg-primary/20 blur-3xl'
          />
          <div className='card-glass relative p-2'>
            <img
              src={profile}
              alt='Portrait of Youssef El Hadraoui'
              width={1280}
              height={1920}
              // React 18 has no fetchPriority prop; the lowercase attribute passes through as-is
              // eslint-disable-next-line react/no-unknown-property
              fetchpriority='high'
              decoding='async'
              className='aspect-[4/5] w-full rounded-[1.25rem] object-cover object-top'
            />
          </div>
        </motion.figure>

        <div>
          <motion.h1 id='hero-title' variants={reveal()} className={styles.heroHeadText}>
            {person.name}{' '}
            <span className='mt-3 block text-2xl font-semibold tracking-normal text-foreground-muted sm:text-3xl'>
              ({person.alias})
            </span>
          </motion.h1>
          <motion.p variants={reveal()} className={`${styles.heroSubText} mt-6`}>
            {person.title}
          </motion.p>

          <motion.div variants={reveal()} className='mt-10 flex flex-wrap gap-4'>
            <a href='#works' className={styles.buttonPrimary}>
              See my projects
            </a>
            <a href='#contact' className={styles.buttonGhost}>
              Get in touch
            </a>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
