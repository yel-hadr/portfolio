import { motion } from 'framer-motion';

import { styles } from '../styles';
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

      <div className='mt-12 grid gap-10 xl:grid-cols-2'>
        <motion.div variants={reveal()} className={styles.card}>
          <ContactForm />
        </motion.div>

        <motion.div variants={reveal(0.1)} className='h-80 md:h-96 xl:h-auto'>
          <SceneView sectionType='earth' className='h-full w-full'>
            {/* Contact's globe always mounts (About's is desktop-only), so it warms up the shaders */}
            <Earth warmUp />
          </SceneView>
        </motion.div>
      </div>
    </>
  );
};

const ContactSection = SectionWrapper(Contact, 'contact');

export default ContactSection;
