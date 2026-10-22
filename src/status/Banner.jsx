import { useI18n } from '../i18n/context';
import StateIcon from './StateIcon';
import { OVERALL_TONE, TONE_TEXT } from './tones';
import { dateTime, displayName, relativeTime } from './format';

const REASON_KEYS = {
  'monitor:down': 'monitorDown',
  'monitor:slow': 'monitorSlow',
  'pipeline:failing': 'pipelineFailing',
  'pipeline:unknown': 'pipelineUnknown',
};

/**
 * The overall status. Green only from published monitor data that is fresh: stale data shows as
 * "last known status" in a neutral tone with a warning, and no data at all says so plainly.
 */
const Banner = ({ data, now, stale }) => {
  const { t, lang } = useI18n();
  const { summary } = data;
  const state = data.phase === 'ready' ? summary.overall : 'unknown';
  const tone = stale ? 'neutral' : OVERALL_TONE[state];
  const label =
    data.phase === 'loading' ? t('statuspage.overall.loading') : t(`statuspage.overall.${state}`);

  const items = [...(summary?.monitors ?? []), ...(summary?.pipelines ?? [])];
  const reasons = (summary?.reasons ?? [])
    .map((r) => {
      const key = REASON_KEYS[`${r.type}:${r.reason}`];
      const item = items.find((i) => i.id === r.id) ?? { id: r.id };
      return key
        ? {
            id: `${r.type}:${r.id}`,
            text: t(`statuspage.overall.${key}`, { name: displayName(t, item) }),
          }
        : null;
    })
    .filter(Boolean);

  return (
    <section
      aria-labelledby='overall-title'
      aria-busy={data.phase === 'loading'}
      className='card-glass p-5 sm:p-7'
    >
      <h2 id='overall-title' className='sr-only'>
        {t('statuspage.overall.label')}
      </h2>
      <p className={`flex items-center gap-3 text-xl font-bold sm:text-2xl ${TONE_TEXT[tone]}`}>
        <StateIcon tone={data.phase === 'loading' ? 'neutral' : tone} className='h-7 w-7' />
        <span>{stale ? t('statuspage.overall.lastKnown', { status: label }) : label}</span>
      </p>

      {summary && (
        <p className='mt-2 text-sm text-foreground-muted'>
          {t('statuspage.overall.checked', {
            time: relativeTime(summary.generatedAt, lang, now, t('statuspage.justNow')),
          })}{' '}
          (<time dateTime={summary.generatedAt}>{dateTime(summary.generatedAt, lang)}</time>)
        </p>
      )}

      {stale && (
        <p className='mt-4 flex gap-2 rounded-xl border border-line-strong bg-surface-raised/60 p-3 text-sm text-foreground'>
          <StateIcon tone='warn' className='h-5 w-5 text-primary-400' />
          <span>{t('statuspage.overall.stale')}</span>
        </p>
      )}

      {reasons.length > 0 && (
        <div className='mt-4 border-t border-line pt-4'>
          <h3 className='text-sm font-semibold text-foreground'>
            {t('statuspage.overall.reasons')}
          </h3>
          <ul className='mt-2 list-disc space-y-1 pl-5 text-sm text-foreground-muted [overflow-wrap:anywhere]'>
            {reasons.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        </div>
      )}

      {data.phase === 'none' && (
        <p className='mt-3 max-w-prose text-sm leading-relaxed text-foreground-muted'>
          {t('statuspage.overall.noData')}
        </p>
      )}
      {data.remote && (
        <p className='mt-3 text-xs text-foreground-muted'>{t('statuspage.overall.remote')}</p>
      )}
    </section>
  );
};

export default Banner;
