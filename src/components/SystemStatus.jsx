import { useRef } from 'react';

import { useI18n } from '../i18n/context';
import { ACTIONS_URL, isGithubUrl, useGithubStatus } from '../hooks/useGithubStatus';

// Per badge state: dot fill, label color (AA on the glass in both themes), and the label and
// time keys in status.json. The text carries the meaning; the dot only echoes it.
const STATES = {
  operational: { dot: 'bg-success', text: 'text-success', time: 'deployedAt' },
  failed: { dot: 'bg-danger', text: 'text-danger', time: 'failedAt' },
  deploying: { dot: 'bg-info motion-safe:animate-pulse', text: 'text-info', time: 'startedAt' },
  incomplete: { dot: 'bg-foreground-muted', text: 'text-foreground-muted', time: 'endedAt' },
  unavailable: { dot: 'bg-foreground-muted', text: 'text-foreground-muted' },
};

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

// "2 hours ago" / "il y a 2 heures"; null under a minute (the caller says "just now")
const relativeTime = (iso, lang) => {
  // Clamped to the past: a visitor clock behind the server's would say "in 2 minutes"
  const seconds = Math.min(0, (Date.parse(iso) - Date.now()) / 1000);
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? [];
  if (!unit) return null;
  try {
    return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(
      Math.round(seconds / size),
      unit
    );
  } catch {
    return null;
  }
};

const LINK =
  'rounded-md transition-colors hover:text-foreground focus-visible:text-foreground text-foreground-muted';

const Dot = ({ className }) => (
  <span aria-hidden='true' className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />
);

const Badge = ({ run }) => {
  const { t, lang } = useI18n();
  const state = run ? run.state : 'unavailable';
  const { dot, text, time } = STATES[state];
  const href = run && isGithubUrl(run.url) ? run.url : ACTIONS_URL;
  const when = run?.time ? relativeTime(run.time, lang) : null;
  const detail =
    time && run?.time ? t(`status.${time}`, { time: when ?? t('status.justNow') }) : null;

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className={`group flex min-h-6 items-start gap-2.5 ${LINK}`}
    >
      <Dot className={dot} />
      <span className='flex flex-col'>
        <span className={`text-sm font-semibold ${text}`}>{t(`status.${state}`)}</span>{' '}
        <span className='text-xs group-hover:underline'>
          {detail ? `${detail} · ` : ''}
          {t(run ? 'status.viewRun' : 'status.viewActions')}
        </span>
      </span>
      <span className='sr-only'> {t('status.newTab')}</span>
    </a>
  );
};

const Commits = ({ commits }) => {
  const { t } = useI18n();
  return (
    <div className='mt-4 border-t border-line pt-3'>
      <h3 className='text-xs font-medium text-foreground-muted'>{t('status.commits')}</h3>
      <ul className='mt-1.5 flex flex-col gap-0.5'>
        {commits.map((commit) =>
          isGithubUrl(commit.url) ? (
            <li key={`${commit.repo}@${commit.sha}`}>
              <a
                href={commit.url}
                target='_blank'
                rel='noopener noreferrer'
                className={`flex min-h-6 items-center gap-2 text-sm ${LINK}`}
              >
                <span className='sr-only'>{t('status.commit')} </span>
                <code className='shrink-0 font-mono text-xs text-primary-400'>
                  {commit.sha}
                </code>{' '}
                <span lang='en' className='min-w-0 flex-1 truncate'>
                  {commit.message}
                </span>{' '}
                <span className='max-w-28 shrink-0 truncate text-xs'>
                  <span className='sr-only'>{t('status.in')} </span>
                  {commit.repo.split('/')[1]}
                </span>
                <span className='sr-only'> {t('status.newTab')}</span>
              </a>
            </li>
          ) : null
        )}
      </ul>
    </div>
  );
};

// Loading placeholder sized like the loaded widget, so nothing jumps when data arrives
const Skeleton = () => {
  const { t } = useI18n();
  return (
    <>
      <p className='flex min-h-6 items-start gap-2.5'>
        <Dot className='bg-foreground-muted motion-safe:animate-pulse' />
        <span className='text-sm font-semibold text-foreground-muted'>{t('status.checking')}</span>
      </p>
      <div aria-hidden='true' className='mt-4 flex flex-col gap-2.5 border-t border-line pt-3'>
        <span className='h-3 w-24 rounded-sm bg-surface-raised' />
        {[0, 1, 2].map((i) => (
          <span key={i} className='h-3.5 rounded-sm bg-surface-raised motion-safe:animate-pulse' />
        ))}
      </div>
    </>
  );
};

/**
 * Footer widget: CI/CD deploy status of this site and the latest public commits, read from the
 * GitHub API once the footer scrolls near. Errors fall back to a neutral "Status unavailable".
 */
const SystemStatus = () => {
  const { t } = useI18n();
  const ref = useRef(null);
  const { status, run, commits } = useGithubStatus(ref);
  const pending = status === 'idle' || status === 'loading';

  return (
    <section
      ref={ref}
      aria-labelledby='system-status-title'
      aria-busy={status === 'loading'}
      // inline-size containment: the nowrap commit lines must not widen the footer's grid track
      className='w-full max-w-sm rounded-2xl border border-line bg-glass p-4 [contain:inline-size]'
    >
      <h2
        id='system-status-title'
        className='mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted'
      >
        {t('status.title')}
      </h2>
      {pending ? (
        <Skeleton />
      ) : (
        <>
          <Badge run={status === 'ready' ? run : null} />
          {status === 'ready' && commits.length > 0 && <Commits commits={commits} />}
        </>
      )}
      {/* The /status/ page: uptime, latency and pipeline history from the scheduled monitor */}
      <a
        href={`${import.meta.env.BASE_URL}status/`}
        className='mt-3 inline-flex min-h-6 items-center rounded-md text-sm font-medium text-primary-400 underline-offset-4 hover:underline'
      >
        {t('status.fullPage')}
      </a>
    </section>
  );
};

export default SystemStatus;
