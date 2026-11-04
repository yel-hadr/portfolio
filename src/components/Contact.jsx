import { useRef } from 'react';
import { m } from 'framer-motion';

import { styles } from '../styles';
import { person } from '../constans';
import { SectionWrapper } from '../hoc';
import { reveal } from '../utils/motion';
import ContactForm from './ContactForm';
import SectionHeader from './SectionHeader';
import { Globe, SceneView } from './canvas';
import GlobeArt from './GlobeArt';
import { useI18n } from '../i18n/context';

const Contact = () => {
  const { t } = useI18n();
  const globeBox = useRef(null);

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

      {/* The form and the globe are for the screen; on paper the email above is the contact */}
      <div className='mt-12 grid gap-10 xl:grid-cols-2 print:hidden'>
        <m.div variants={reveal()} className={styles.card}>
          <ContactForm />
        </m.div>

        <m.div variants={reveal(0.1)} className='h-80 md:h-96 xl:h-auto'>
          {/* Without 3D (no WebGL2, a lost context) the globe drawn flat; while the 3D one
              loads, the same drawing faded, so the slot is never an empty hole */}
          <SceneView
            sectionType='globe'
            className='h-full w-full'
            fallback={<GlobeArt className='h-auto max-h-full w-4/5 max-w-sm' />}
            placeholder={<GlobeArt className='h-auto max-h-full w-4/5 max-w-sm opacity-30' />}
            boxRef={globeBox}
          >
            {/* Mounts once Contact is a viewport away; its arcs draw in once the box is in view */}
            <Globe boxRef={globeBox} />
          </SceneView>
        </m.div>
      </div>
    </>
  );
};

const ContactSection = SectionWrapper(Contact, 'contact');

export default ContactSection;
