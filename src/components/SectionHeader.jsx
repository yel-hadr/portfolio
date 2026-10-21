import { motion } from 'framer-motion';

import { styles } from '../styles';
import { reveal } from '../utils/motion';

/**
 * Section heading + optional lead sentence. The heading id matches the
 * aria-labelledby that SectionWrapper puts on the <section>.
 */
const SectionHeader = ({ id, title, lead }) => (
  <motion.header variants={reveal()}>
    <h2 id={`${id}-title`} className={styles.sectionHeadText}>
      {title}
    </h2>
    {lead && <p className={styles.sectionLead}>{lead}</p>}
  </motion.header>
);

export default SectionHeader;
