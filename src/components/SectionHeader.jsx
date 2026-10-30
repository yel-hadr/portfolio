import { m } from 'framer-motion';

import { styles } from '../styles';
import { reveal } from '../utils/motion';
import { useI18n } from '../i18n/context';

/**
 * Section heading + optional lead sentence, under the section's eyebrow label
 * (eyebrows.<id> in core.json). The heading id matches the aria-labelledby that SectionWrapper
 * puts on the <section>, so the heading alone names the section.
 */
const SectionHeader = ({ id, title, lead }) => {
  const { t } = useI18n();
  return (
    <m.header variants={reveal()}>
      <p className={`${styles.eyebrow} mb-3`}>{t(`eyebrows.${id}`)}</p>
      <h2 id={`${id}-title`} className={styles.sectionHeadText}>
        {title}
      </h2>
      {lead && <p className={styles.sectionLead}>{lead}</p>}
    </m.header>
  );
};

export default SectionHeader;
