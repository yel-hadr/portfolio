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
        // Once, as the section's top passes 10% above the viewport's bottom. The root reaches
        // far above the screen, so a section jumped past (End, a deep link, a fast scroll) counts
        // as seen and is shown, rather than waiting invisible for a scroll back up
        viewport={{ once: true, margin: '100000px 0px -10% 0px' }}
        className={`${styles.container} ${styles.section} relative`}
      >
        <Component />
      </m.section>
    );
  };

export default SectionWrapper;
