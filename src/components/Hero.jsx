import { motion } from 'framer-motion';

import { styles } from '../styles';
import { reveal, staggerContainer } from '../utils/motion';
import { Computers, SceneView } from './canvas';

const Hero = () => {
  return (
    <section id="hero" aria-labelledby="hero-title" className="relative w-full min-h-screen">
      <SceneView
        sectionType="hero"
        label="3D model of a desk setup with a computer, keyboard and monitor"
        className="absolute inset-0 pointer-events-none"
      >
        <Computers />
      </SceneView>

      {/* The page's one orchestrated entrance: heading, then the introduction. */}
      <motion.div
        variants={staggerContainer(0.12, 0.1)}
        initial="hidden"
        animate="show"
        className={`${styles.container} relative z-10 flex gap-5 pt-32 sm:pt-36`}
      >
        <div aria-hidden="true" className="mt-4 flex flex-col items-center">
          <div className="h-5 w-5 rounded-full bg-primary" />
          <div className="w-1 h-40 sm:h-80 bg-gradient-to-b from-primary to-transparent" />
        </div>

        <div>
          <motion.h1 id="hero-title" variants={reveal()} className={styles.heroHeadText}>
            Hi, I&apos;m <span className="text-primary">Youssef</span>
          </motion.h1>
          <motion.p variants={reveal()} className={`${styles.heroSubText} mt-6`}>
            I&apos;m a software engineering student at UM6P-1337 with a strong foundation in developing
            efficient and scalable software solutions.
          </motion.p>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
