import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import { styles } from '../styles';
import { SectionWrapper } from '../hoc';
import { tils } from '../constans';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import { useI18n } from '../i18n/context';

// Tag colors are theme tokens with AA contrast on surface-raised in both themes (as in Works)
const TAG_COLORS = {
  info: 'text-info',
  success: 'text-success',
  danger: 'text-danger',
  primary: 'text-primary-400',
};

// Line-comment markers per snippet language, for the one bit of highlighting we do by hand
const COMMENT_MARKERS = {
  ini: [';', '#'],
  yaml: ['#'],
  shell: ['#'],
  hcl: ['#', '//'],
  python: ['#'],
};

// Index where a line comment starts, or -1. A marker counts at the start of the line or after
// whitespace, and never inside a quoted string (so "#" in a value stays code).
const commentStart = (line, markers) => {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (
      (i === 0 || /\s/.test(line[i - 1])) &&
      markers.some((marker) => line.startsWith(marker, i))
    ) {
      return i;
    }
  }
  return -1;
};

// `inline code` in the translated bodies -> <code>
const renderBody = (text) =>
  text.split(/`([^`]+)`/).map((part, i) =>
    i % 2 ? (
      <code key={i} className='rounded bg-surface-raised px-1 font-mono text-sm text-foreground'>
        {part}
      </code>
    ) : (
      part
    )
  );

const CopyIcon = () => (
  <svg
    aria-hidden='true'
    focusable='false'
    viewBox='0 0 20 20'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.75'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='h-4 w-4'
  >
    <rect x='7' y='7' width='10' height='10' rx='2' />
    <path d='M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2' />
  </svg>
);

const CodeBlock = ({ language, snippet, title }) => {
  const { t } = useI18n();
  const codeRef = useRef(null);
  const timer = useRef(0);
  const attempts = useRef(0);
  // null | 'copied' | 'failed', announced through the status region
  const [status, setStatus] = useState(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lines = useMemo(() => {
    const markers = COMMENT_MARKERS[language] ?? [];
    return snippet.split('\n').map((line) => {
      const at = commentStart(line, markers);
      return at < 0 ? [line, ''] : [line.slice(0, at), line.slice(at)];
    });
  }, [language, snippet]);

  const copy = async () => {
    const attempt = ++attempts.current;
    window.clearTimeout(timer.current);
    // Clearing first makes a repeated result count as a change for screen readers
    setStatus(null);
    let outcome = 'copied';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(snippet);
    } catch {
      // No permission or no secure context: select the code so the keyboard copy still works
      outcome = 'failed';
      if (codeRef.current) window.getSelection()?.selectAllChildren(codeRef.current);
    }
    // Without the API the catch runs synchronously, and React would batch the clear and the
    // result into one render. Waiting lets the empty region render (and reach the accessibility
    // tree) before the new message, so a repeated failure is announced again.
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    // A newer click owns the status region now
    if (attempt !== attempts.current) return;
    setStatus(outcome);
    timer.current = window.setTimeout(() => setStatus(null), outcome === 'copied' ? 2500 : 8000);
  };

  return (
    <div className='mt-auto pt-6'>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-xl border border-b-0 border-line bg-surface-raised py-2 pl-4 pr-2'>
        <span className='mr-auto font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted'>
          {language}
        </span>
        <span
          role='status'
          className={`text-xs font-semibold ${status === 'failed' ? 'text-danger' : 'text-success'}`}
        >
          {status === 'copied' && t('til.copied')}
          {status === 'failed' && t('til.copyFailed')}
        </span>
        <button
          type='button'
          onClick={copy}
          className='ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1 text-sm font-semibold text-foreground transition-colors hover:border-foreground-muted'
        >
          <CopyIcon />
          {t('til.copy')}
          <span className='sr-only'>{t('til.copySr', { title })}</span>
        </button>
      </div>
      {/* Long lines scroll inside the block; tabIndex lets keyboard users scroll it */}
      <pre
        tabIndex={0}
        role='region'
        aria-label={t('til.codeLabel', { language, title })}
        className='overflow-x-auto rounded-b-xl border border-line bg-surface p-4 font-mono text-sm leading-relaxed text-foreground'
      >
        <code ref={codeRef}>
          {lines.map(([code, comment], i) => (
            <span key={i}>
              {code}
              {comment && <span className='italic text-foreground-muted'>{comment}</span>}
              {i < lines.length - 1 && '\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
};

const TilCard = ({ id, tags, code }) => {
  const { t } = useI18n();
  const title = t(`til.items.${id}.title`);

  return (
    <motion.li variants={reveal()} className={`${styles.card} flex min-w-0 flex-col`}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <ul className='mt-3 flex flex-wrap gap-2' aria-label={t('til.topics')}>
        {tags.map((tag) => (
          <li
            key={tag.name}
            className={`rounded-full border border-line bg-surface-raised px-3 py-1 text-sm font-medium ${TAG_COLORS[tag.color] ?? 'text-foreground-muted'}`}
          >
            {tag.name}
          </li>
        ))}
      </ul>
      <p className={`mt-4 ${styles.body}`}>{renderBody(t(`til.items.${id}.body`))}</p>
      <CodeBlock {...code} title={title} />
    </motion.li>
  );
};

const Til = () => {
  const { t } = useI18n();

  return (
    <>
      <SectionHeader id='til' title={t('til.title')} lead={t('til.lead')} />
      <ul className='mt-12 grid gap-8 md:grid-cols-2'>
        {tils.map((til) => (
          <TilCard key={til.id} {...til} />
        ))}
      </ul>
    </>
  );
};

const TilSection = SectionWrapper(Til, 'til');

export default TilSection;
