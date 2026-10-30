import { m } from 'framer-motion';

import { styles } from '../styles';
import { reveal } from '../utils/motion';

/**
 * Section heading + optional lead sentence. The heading id matches the
 * aria-labelledby that SectionWrapper puts on the <section>.
 */
const SectionHeader = ({ id, title, lead }) => (
  <m.header variants={reveal()}>
    <h2 id={`${id}-title`} className={styles.sectionHeadText}>
      {title}
    </h2>
    {lead && <p className={styles.sectionLead}>{lead}</p>}
  </m.header>
);

export default SectionHeader;
