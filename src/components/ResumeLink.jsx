import { m } from 'framer-motion';

import { styles } from '../styles';
import { person } from '../constans';
import { useI18n } from '../i18n/context';
import { track } from '../utils/analytics';
import { pressable } from '../utils/motion';

/**
 * "Download resume" button. The download attribute saves the PDF instead of opening it in the
 * browser's viewer; the visible text is part of the accessible name (WCAG 2.5.3).
 */
const ResumeLink = ({ className = '' }) => {
  const { t } = useI18n();
  return (
    <m.a
      href={person.resume}
      download='Youssef_Elhadraoui_Resume.pdf'
      type='application/pdf'
      aria-label={t('resume.aria')}
      onClick={() => track('resume-download')}
      className={`${styles.buttonGhost} gap-2 ${className}`}
      {...pressable}
    >
      <svg
        aria-hidden='true'
        viewBox='0 0 20 20'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.75'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='h-5 w-5'
      >
        <path d='M10 3v10m0 0-4-4m4 4 4-4M4 16h12' />
      </svg>
      {t('resume.label')}
    </m.a>
  );
};

export default ResumeLink;
