import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { m } from 'framer-motion';

import { useI18n } from '../i18n/context';
import { pressable } from '../utils/motion';

const FIELD =
  'w-full rounded-xl border border-line-strong bg-surface-raised px-5 py-4 font-medium text-foreground ' +
  'placeholder:text-foreground-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const EMPTY_FORM = { name: '', email: '', message: '' };

// The endpoint's limits (contact-api/lib/contact.js), so the browser stops a message it would refuse
const MAX = { name: 100, email: 254, message: 5000 };

/**
 * Posts the message to the contact endpoint (a Vercel function that sends it through Resend; its
 * public URL is VITE_CONTACT_ENDPOINT, the Resend key never leaves the function). Resolves to the
 * status shown under the form
 */
const send = async (form) => {
  const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT;
  if (!endpoint) {
    console.error(
      'Missing contact endpoint: set VITE_CONTACT_ENDPOINT (see contact-api/README.md).'
    );
    return { type: 'error', key: 'contact.notConfigured' };
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
      // A hung endpoint must not leave the form stuck on Sending: abort, and say it failed
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) return { type: 'success', key: 'contact.sent' };
    console.error(`Contact endpoint answered ${response.status}`);
    const key =
      { 503: 'contact.notConfigured', 429: 'contact.tooMany' }[response.status] ?? 'contact.failed';
    return { type: 'error', key };
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
    <m.button
      type='submit'
      aria-disabled={pending || undefined}
      {...pressable}
      className='rounded-xl border-2 border-transparent bg-primary px-8 py-3 font-bold text-on-primary transition-colors hover:bg-primary-hover aria-disabled:cursor-wait focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background'
    >
      {pending ? t('contact.sending') : t('contact.send')}
    </m.button>
  );
};

/**
 * The contact form (sent through the contact endpoint, VITE_CONTACT_ENDPOINT), used by the Contact section and by
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
      Object.fromEntries(['name', 'email', 'message', 'website'].map((k) => [k, data.get(k) ?? '']))
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
      {/* Read with each field (aria-describedby): a <form> without a name is not announced */}
      <p id={ids.hint} className='mb-6 text-sm text-foreground-muted'>
        {t('contact.required')}
      </p>
      <form action={sendAction} onSubmit={onSubmit} className='flex flex-col gap-6'>
        <div className='flex flex-col gap-2'>
          <label htmlFor={ids.name} className='font-medium text-foreground'>
            {t('contact.name')}
          </label>
          <input
            id={ids.name}
            type='text'
            name='name'
            autoComplete='name'
            maxLength={MAX.name}
            value={form.name}
            onChange={handleChange}
            className={FIELD}
            aria-describedby={ids.hint}
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
            maxLength={MAX.email}
            placeholder={t('contact.emailPlaceholder')}
            value={form.email}
            onChange={handleChange}
            className={FIELD}
            aria-describedby={ids.hint}
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
            maxLength={MAX.message}
            placeholder={t('contact.messagePlaceholder')}
            value={form.message}
            onChange={handleChange}
            className={`${FIELD} resize-y`}
            aria-describedby={ids.hint}
            required
          />
        </div>

        {/* A trap for bots, which fill every field: hidden from everyone (display: none keeps it out
            of the accessibility tree and the tab order); a message with it filled is dropped */}
        <div hidden>
          <input type='text' name='website' tabIndex={-1} autoComplete='off' defaultValue='' />
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
