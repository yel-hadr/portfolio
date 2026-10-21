import { motion } from "framer-motion";
import { staggerContainer } from "../utils/motion";
import { styles } from "../styles";

/**
 * Wraps a page section: shared padding/width, the section anchor (`id`, used by the nav),
 * a label pointing at the section heading (`${idName}-title`, see SectionHeader), and the
 * one reveal-on-scroll motion used across the page.
 */
const SectionWrapper = (Component, idName) =>
  function HOC() {
    return (
      <motion.section
        id={idName}
        aria-labelledby={`${idName}-title`}
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        className={`${styles.container} ${styles.section} relative scroll-mt-20`}
      >
        <Component />
      </motion.section>
    );
  };

export default SectionWrapper;
