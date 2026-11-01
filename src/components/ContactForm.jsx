import { useActionState, useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { m } from 'framer-motion';

import { useI18n } from '../i18n/context';
import { pressable } from '../utils/motion';

const FIELD =
  'w-full rounded-xl border border-line-strong bg-surface-raised px-5 py-4 font-medium text-foreground ' +
  'aria-invalid:border-danger placeholder:text-foreground-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const EMPTY_FORM = { name: '', email: '', message: '' };

// The endpoint's limits (contact-api/lib/contact.js), so the browser stops a message it would refuse
const MAX = { name: 100, email: 254, message: 5000 };
// The endpoint's own email check
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELDS = ['name', 'email', 'message'];

/**
 * The form's own checks, in place of the browser's popups (which speak the browser's language,
 * not the page's): a locale key per field that fails, under `contact.errors`
 */
const check = (name, value) => {
  const v = value.trim();
  if (!v) return `contact.errors.${name}Missing`;
  if (name === 'email' && !EMAIL.test(v)) return 'contact.errors.emailInvalid';
  return null;
};

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

// The message being written, kept outside the form: a dialog that closes on Escape or a click
// outside it (Game Mode's Contact dossier) must not throw away what a visitor typed. Every copy of
// the form shares it (in memory only, for this page); a message sent clears it
let draft = EMPTY_FORM;
const keepDraft = (form) => {
  draft = form;
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
  // { name: key | null, ... }: shown under each field once a submit found it wrong, and cleared as
  // soon as it is right
  const [errors, setErrors] = useState({});
  const fieldRefs = { name: useRef(null), email: useRef(null), message: useRef(null) };
  // Controlled fields: a failed send keeps what was typed, a sent one clears them
  const [form, setForm] = useState(() => draft);
  // { type: 'success' | 'error', key } shown in a live region instead of alert(); a key, not
  // text, so the message follows a language switch
  const [status, sendAction, pending] = useActionState(async (previous, data) => {
    const result = await send(
      Object.fromEntries(['name', 'email', 'message', 'website'].map((k) => [k, data.get(k) ?? '']))
    );
    if (result.type === 'success') {
      setForm(EMPTY_FORM);
      keepDraft(EMPTY_FORM);
    }
    return result;
  }, null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    keepDraft(next);
    // A field marked wrong is checked again as it is typed in, so the message goes once it is right
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: check(name, value) }));
  };

  // One message at a time: a second submit (Enter in a field) while one is sending does nothing.
  // A message with a field missing or wrong is not sent: each field says what is wrong, and the
  // first such field takes focus (its message is read with it)
  const onSubmit = (e) => {
    if (pending) {
      e.preventDefault();
      return;
    }
    const found = Object.fromEntries(FIELDS.map((name) => [name, check(name, form[name])]));
    setErrors(found);
    const first = FIELDS.find((name) => found[name]);
    if (first) {
      e.preventDefault();
      fieldRefs[first].current?.focus();
    }
  };

  // What each field reads besides its label: the required hint, and its error when there is one
  const fieldProps = (name) => ({
    id: ids[name],
    name,
    ref: fieldRefs[name],
    maxLength: MAX[name],
    value: form[name],
    onChange: handleChange,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${ids[name]}err ${ids.hint}` : ids.hint,
    required: true,
  });
  const fieldError = (name) =>
    errors[name] && (
      <p id={`${ids[name]}err`} className='text-sm font-medium text-danger'>
        {t(errors[name])}
      </p>
    );

  return (
    <>
      {/* Read with each field (aria-describedby): a <form> without a name is not announced */}
      <p id={ids.hint} className='mb-6 text-sm text-foreground-muted'>
        {t('contact.required')}
      </p>
      <form action={sendAction} onSubmit={onSubmit} noValidate className='flex flex-col gap-6'>
        <div className='flex flex-col gap-2'>
          <label htmlFor={ids.name} className='font-medium text-foreground'>
            {t('contact.name')}
          </label>
          <input
            {...fieldProps('name')}
            type='text'
            autoComplete='name'
            placeholder={t('contact.namePlaceholder')}
            className={FIELD}
          />
          {fieldError('name')}
        </div>
        <div className='flex flex-col gap-2'>
          <label htmlFor={ids.email} className='font-medium text-foreground'>
            {t('contact.email')}
          </label>
          <input
            {...fieldProps('email')}
            type='email'
            autoComplete='email'
            placeholder={t('contact.emailPlaceholder')}
            className={FIELD}
          />
          {fieldError('email')}
        </div>
        <div className='flex flex-col gap-2'>
          <label htmlFor={ids.message} className='font-medium text-foreground'>
            {t('contact.message')}
          </label>
          <textarea
            {...fieldProps('message')}
            rows={6}
            placeholder={t('contact.messagePlaceholder')}
            className={`${FIELD} resize-y`}
          />
          {fieldError('message')}
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
