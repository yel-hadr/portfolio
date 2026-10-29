import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { useI18n } from '../i18n/context';

const FIELD =
  'w-full rounded-xl border border-line-strong bg-surface-raised px-5 py-4 font-medium text-foreground ' +
  'placeholder:text-foreground-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const EMPTY_FORM = { name: '', email: '', message: '' };

/** Sends the message through EmailJS; resolves to the status shown under the form */
const send = async (form) => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.error(
      'Missing EmailJS configuration. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID and VITE_EMAILJS_PUBLIC_KEY in .env.'
    );
    return { type: 'error', key: 'contact.notConfigured' };
  }
  try {
    // Loaded on send only: the library reads localStorage at import time, which throws when
    // the visitor blocks site data and would otherwise blank the whole page
    const { default: emailjs } = await import('@emailjs/browser');
    await emailjs.send(
      serviceId,
      templateId,
      {
        from_name: form.name,
        to_name: 'Youssef El Hadraoui',
        from_email: form.email,
        to_email: 'youssefelhadraoui99@gmail.com',
        message: form.message,
      },
      publicKey
    );
    return { type: 'success', key: 'contact.sent' };
  } catch (error) {
    console.error(error);
    return { type: 'error', key: 'contact.failed' };
  }
};

/** The submit button: its label and busy state come from the form's pending action */
const SubmitButton = () => {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    // aria-disabled instead of disabled: a disabled button would drop keyboard focus to <body>
    <button
      type='submit'
      aria-disabled={pending || undefined}
      className='rounded-xl border-2 border-transparent bg-primary px-8 py-3 font-bold text-on-primary transition-colors hover:bg-primary-hover aria-disabled:cursor-wait focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background'
    >
      {pending ? t('contact.sending') : t('contact.send')}
    </button>
  );
};

/**
 * The contact form (EmailJS, keys from VITE_EMAILJS_* only), used by the Contact section and by
 * Game Mode's comms room. Ids are generated, so two copies on one page never share an id. A React
 * 19 form action: useActionState holds the result, useFormStatus the button's pending state.
 */
const ContactForm = () => {
  const uid = useId();
  const ids = {
    hint: `${uid}hint`,
    name: `${uid}name`,
    email: `${uid}email`,
    message: `${uid}message`,
  };
  const { t } = useI18n();
  // Controlled fields: a failed send keeps what was typed, a sent one clears them
  const [form, setForm] = useState(EMPTY_FORM);
  // { type: 'success' | 'error', key } shown in a live region instead of alert(); a key, not
  // text, so the message follows a language switch
  const [status, sendAction, pending] = useActionState(async (previous, data) => {
    const result = await send(
      Object.fromEntries(['name', 'email', 'message'].map((k) => [k, data.get(k)]))
    );
    if (result.type === 'success') setForm(EMPTY_FORM);
    return result;
  }, null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // One message at a time: a second submit (Enter in a field) while one is sending does nothing
  const onSubmit = (e) => {
    if (pending) e.preventDefault();
  };

  return (
    <>
      <p id={ids.hint} className='mb-6 text-sm text-foreground-muted'>
        {t('contact.required')}
      </p>
      <form
        action={sendAction}
        onSubmit={onSubmit}
        aria-describedby={ids.hint}
        className='flex flex-col gap-6'
      >
        <div className='flex flex-col gap-2'>
          <label htmlFor={ids.name} className='font-medium text-foreground'>
            {t('contact.name')}
          </label>
          <input
            id={ids.name}
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
          <label htmlFor={ids.email} className='font-medium text-foreground'>
            {t('contact.email')}
          </label>
          <input
            id={ids.email}
            type='email'
            name='email'
            autoComplete='email'
            placeholder={t('contact.emailPlaceholder')}
            value={form.email}
            onChange={handleChange}
            className={FIELD}
            required
          />
        </div>
        <div className='flex flex-col gap-2'>
          <label htmlFor={ids.message} className='font-medium text-foreground'>
            {t('contact.message')}
          </label>
          <textarea
            id={ids.message}
            rows={6}
            name='message'
            placeholder={t('contact.messagePlaceholder')}
            value={form.message}
            onChange={handleChange}
            className={`${FIELD} resize-y`}
            required
          />
        </div>

        <div className='flex flex-wrap items-center gap-4'>
          <SubmitButton />
          <p role='status' className='text-sm font-medium text-success'>
            {!pending && status?.type === 'success' ? t(status.key) : ''}
          </p>
          <p role='alert' className='text-sm font-medium text-danger'>
            {!pending && status?.type === 'error' ? t(status.key) : ''}
          </p>
        </div>
      </form>
    </>
  );
};

export default ContactForm;
