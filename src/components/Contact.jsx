import { m } from 'framer-motion';

import { styles } from '../styles';
import { person } from '../constans';
import { SectionWrapper } from '../hoc';
import { reveal } from '../utils/motion';
import ContactForm from './ContactForm';
import SectionHeader from './SectionHeader';
import { Earth, SceneView } from './canvas';
import { useI18n } from '../i18n/context';

const Contact = () => {
  const { t } = useI18n();

  return (
    <>
      <SectionHeader id='contact' title={t('contact.title')} lead={t('contact.lead')} />
      {/* The address in plain sight, for those who would rather write from their own mail */}
      <m.p variants={reveal()} className={`${styles.sectionLead} !mt-3 break-words`}>
        {t('contact.emailLead')}{' '}
        <a
          href={`mailto:${person.email}`}
          // A resting underline, and a full one drawing in from the left on hover (.link-draw)
          className='link-draw inline-block max-w-full break-all font-semibold text-primary-400 underline decoration-primary-400/50 transition-colors hover:text-foreground'
        >
          {person.email}
        </a>
      </m.p>

      <div className='mt-12 grid gap-10 xl:grid-cols-2'>
        <m.div variants={reveal()} className={styles.card}>
          <ContactForm />
        </m.div>

        <m.div variants={reveal(0.1)} className='h-80 md:h-96 xl:h-auto'>
          <SceneView sectionType='earth' className='h-full w-full'>
            {/* Mounts once Contact is a viewport away; it compiles its shaders while it loads */}
            <Earth warmUp />
          </SceneView>
        </m.div>
      </div>
    </>
  );
};

const ContactSection = SectionWrapper(Contact, 'contact');

export default ContactSection;
