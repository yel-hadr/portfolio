import { useState } from 'react';
import emailjs from '@emailjs/browser';
import { motion } from 'framer-motion';

import { styles } from '../styles';
import { SectionWrapper } from '../hoc';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import { Earth, SceneView } from './canvas';

const FIELD =
  'w-full rounded-xl border border-line-strong bg-surface-raised px-5 py-4 font-medium text-foreground ' +
  'placeholder:text-foreground-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const EMPTY_FORM = { name: '', email: '', message: '' };

const Contact = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  // { type: 'success' | 'error', message } shown in a live region instead of alert()
  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      console.error(
        'Missing EmailJS configuration. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID and VITE_EMAILJS_PUBLIC_KEY in .env.'
      );
      setStatus({
        type: 'error',
        message: "Message not sent: the contact form isn't configured yet. Please try again later.",
      });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      await emailjs.send(
        serviceId,
        templateId,
        {
          from_name: form.name,
          to_name: 'Youssef El hadraoui',
          from_email: form.email,
          to_email: 'yousefelhadraoui99@gmail.com',
          message: form.message,
        },
        publicKey
      );
      setStatus({
        type: 'success',
        message: "Message sent. I'll get back to you as soon as possible.",
      });
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error(error);
      setStatus({
        type: 'error',
        message: 'Message not sent. Check your connection and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SectionHeader
        id='contact'
        title='Contact me.'
        lead='Have a question or an opportunity? Send me a message.'
      />

      <div className='mt-12 grid gap-10 xl:grid-cols-2'>
        <motion.div variants={reveal()} className={styles.card}>
          <p id='contact-hint' className='mb-6 text-sm text-foreground-muted'>
            All fields are required.
          </p>
          <form
            onSubmit={handleSubmit}
            aria-describedby='contact-hint'
            className='flex flex-col gap-6'
          >
            <div className='flex flex-col gap-2'>
              <label htmlFor='contact-name' className='font-medium text-foreground'>
                Name
              </label>
              <input
                id='contact-name'
                type='text'
                name='name'
                autoComplete='name'
                value={form.name}
                onChange={handleChange}
                className={FIELD}
                required
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label htmlFor='contact-email' className='font-medium text-foreground'>
                Email
              </label>
              <input
                id='contact-email'
                type='email'
                name='email'
                autoComplete='email'
                placeholder='you@example.com'
                value={form.email}
                onChange={handleChange}
                className={FIELD}
                required
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label htmlFor='contact-message' className='font-medium text-foreground'>
                Message
              </label>
              <textarea
                id='contact-message'
                rows={6}
                name='message'
                placeholder='What would you like to talk about?'
                value={form.message}
                onChange={handleChange}
                className={`${FIELD} resize-y`}
                required
              />
            </div>

            <div className='flex flex-wrap items-center gap-4'>
              {/* aria-disabled instead of disabled: a disabled button would drop keyboard focus to <body> */}
              <button
                type='submit'
                aria-disabled={loading || undefined}
                className='rounded-xl border-2 border-transparent bg-primary px-8 py-3 font-bold text-background transition-colors hover:bg-primary-400 aria-disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              >
                {loading ? 'Sending…' : 'Send message'}
              </button>
              <p role='status' className='text-sm font-medium text-emerald-300'>
                {status?.type === 'success' ? status.message : ''}
              </p>
              <p role='alert' className='text-sm font-medium text-pink-300'>
                {status?.type === 'error' ? status.message : ''}
              </p>
            </div>
          </form>
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
