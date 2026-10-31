import { m } from 'framer-motion';
import { staggerContainer } from '../utils/motion';
import { styles } from '../styles';

/**
 * Wraps a page section: shared padding/width, the section anchor (`id`, used by the nav),
 * a label pointing at the section heading (`${idName}-title`, see SectionHeader), and the
 * one reveal-on-scroll motion used across the page.
 */
const SectionWrapper = (Component, idName) =>
  function HOC() {
    return (
      <m.section
        id={idName}
        aria-labelledby={`${idName}-title`}
        variants={staggerContainer()}
        initial='hidden'
        whileInView='show'
        // Once, as the section's top passes 100px into the viewport
        viewport={{ once: true, margin: '-100px' }}
        className={`${styles.container} ${styles.section} relative`}
      >
        <Component />
      </m.section>
    );
  };

export default SectionWrapper;
