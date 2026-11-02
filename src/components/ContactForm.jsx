import { useActionState, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { m } from 'framer-motion';

import { person } from '../constans';
import { useI18n } from '../i18n/context';
import { styles } from '../styles';
import { pressable } from '../utils/motion';
import { CheckIcon, SpinnerIcon } from './icons';

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
    // An answer that is not a success is the endpoint's failure, not the visitor's connection
    const key =
      { 503: 'contact.notConfigured', 429: 'contact.tooMany' }[response.status] ?? 'contact.failed';
    return { type: 'error', key };
  } catch (error) {
    // No answer at all (offline, a network error or the 15 s timeout)
    console.error(error);
    return { type: 'error', key: 'contact.offline' };
  }
};

// The message being written, kept outside the form: a dialog that closes on Escape or a click
// outside it (Game Mode's Contact dossier) must not throw away what a visitor typed. Every copy of
// the form shares it (in memory only, for this page); a message sent clears it
let draft = EMPTY_FORM;
const keepDraft = (form) => {
  draft = form;
};

const FOCUS_RING =
  'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** The submit button: its label, spinner and busy state come from the form's pending action */
const SubmitButton = () => {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    // aria-disabled instead of disabled: a disabled button would drop keyboard focus to <body>
    <m.button
      type='submit'
      aria-disabled={pending || undefined}
      {...pressable}
      className={`${styles.buttonPrimary} gap-2 aria-disabled:cursor-wait ${FOCUS_RING}`}
    >
      {pending && <SpinnerIcon className='h-5 w-5 motion-safe:animate-spin' />}
      {pending ? t('contact.sending') : t('contact.send')}
    </m.button>
  );
};

/**
 * In place of the form once a message is sent: a check, a title and the confirmation, and a
 * button that brings the form back. It takes focus as it appears (the submit button that had it is
 * gone), so its title and text are read
 */
const SentPanel = ({ onAnother, onFocusSkipped }) => {
  const { t } = useI18n();
  const uid = useId();
  const panelRef = useRef(null);
  // An effect event: the check runs once, as the panel appears, whatever the parent passes
  const skipped = useEffectEvent(() => onFocusSkipped?.());
  useEffect(() => {
    // Only when focus went with the form (the submit button unmounted, so it is on <body>): a
    // visitor who moved on during the send keeps their place
    const current = document.activeElement;
    if (!current || current === document.body) panelRef.current?.focus();
    // Not focused, it is not read either: the form's live region says it instead
    // (already on the panel: StrictMode's second run in development, nothing was skipped)
    else if (!panelRef.current?.contains(current)) skipped();
  }, []);
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role='group'
      aria-labelledby={`${uid}title`}
      aria-describedby={`${uid}text`}
      className='flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface-raised/60 p-6 outline-hidden'
    >
      <span className='inline-flex h-11 w-11 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success'>
        <CheckIcon className='h-6 w-6' />
      </span>
      <div>
        <p id={`${uid}title`} className='text-lg font-bold text-foreground'>
          {t('contact.sentTitle')}
        </p>
        <p id={`${uid}text`} className='mt-1 leading-relaxed text-foreground-muted'>
          {t('contact.sent')}
        </p>
      </div>
      <button
        type='button'
        onClick={onAnother}
        className={`link-draw inline-flex min-h-11 items-center rounded-sm font-semibold text-primary-400 underline decoration-line-strong underline-offset-4 transition-colors hover:text-foreground ${FOCUS_RING}`}
      >
        {t('contact.sendAnother')}
      </button>
    </div>
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
  const nameRef = useRef(null);
  const fieldRefs = { name: nameRef, email: useRef(null), message: useRef(null) };
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
  // The sent result the visitor has moved on from ("Send another message"): the form is back
  const [dismissed, setDismissed] = useState(null);
  const sent = !pending && status?.type === 'success' && status !== dismissed;
  // Back from the sent panel, the form's first field takes focus (the panel's button is gone)
  const [refocus, setRefocus] = useState(false);
  useEffect(() => {
    if (!refocus) return;
    nameRef.current?.focus();
    setRefocus(false);
  }, [refocus]);
  // The panel did not take focus (the visitor had moved on during the send): its message goes
  // to the live region instead, so the success is still announced
  const [sentSaid, setSentSaid] = useState(false);
  const sendAnother = () => {
    setDismissed(status);
    setRefocus(true);
    setSentSaid(false);
  };

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

  // The busy state, announced: the button's own label change is not read while it has focus.
  // First in both branches, so React keeps the same live region across the swap to the panel
  const busy = (
    <p role='status' className='sr-only'>
      {pending ? t('contact.sending') : ''}
      {!pending && sent && sentSaid ? `${t('contact.sentTitle')}. ${t('contact.sent')}` : ''}
    </p>
  );

  if (sent)
    return (
      <>
        {busy}
        <SentPanel onAnother={sendAnother} onFocusSkipped={() => setSentSaid(true)} />
      </>
    );

  return (
    <>
      {busy}
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
          <p role='alert' className='text-sm font-medium text-danger'>
            {!pending && status?.type === 'error' ? t(status.key, { email: person.email }) : ''}
          </p>
        </div>
      </form>
    </>
  );
};

export default ContactForm;
