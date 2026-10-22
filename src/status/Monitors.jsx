import { useI18n } from '../i18n/context';
import Sparkline from './Sparkline';
import StateLabel from './StateLabel';
import { configuredMonitors } from './useStatusData';
import { MONITOR_TONE } from './tones';
import { DAY, displayName, formatMs, formatPct, isHttpUrl, seriesOf } from './format';

const Stat = ({ label, children }) => (
  <div>
    <dt className='text-xs text-foreground-muted'>{label}</dt>
    <dd className='mt-0.5 font-semibold tabular-nums text-foreground'>{children}</dd>
  </div>
);

const Tag = ({ children }) => (
  <span className='rounded-md border border-line-strong px-1.5 py-0.5 text-xs font-medium text-foreground-muted'>
    {children}
  </span>
);

// "yel-hadr.github.io/blog/rss.xml": shorter than the URL, still unambiguous
const shortUrl = (url) => {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname === '/' ? '' : pathname}`;
  } catch {
    return url;
  }
};

const MonitorCard = ({ monitor, samples, now, asOf }) => {
  const { t, lang } = useI18n();
  const state = monitor.state ?? 'none';
  const tone = MONITOR_TONE[state] ?? 'neutral';
  const stateLabel =
    state === 'none' ? t('statuspage.monitors.noData') : t(`statuspage.monitors.${state}`);
  const name = displayName(t, monitor);
  const error =
    monitor.error === 'timeout' ? t('statuspage.monitors.timeout') : (monitor.error ?? null);

  return (
    <li className='card-glass p-5'>
      <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-2'>
        <div className='min-w-0'>
          <h3 className='flex flex-wrap items-center gap-2 font-semibold text-foreground'>
            <span className='min-w-0 [overflow-wrap:anywhere]'>{name}</span>
            {monitor.critical && <Tag>{t('statuspage.monitors.critical')}</Tag>}
            {monitor.kind === 'server' && <Tag>{t('statuspage.monitors.server')}</Tag>}
          </h3>
          {isHttpUrl(monitor.url) && (
            <a
              href={monitor.url}
              target='_blank'
              rel='noopener noreferrer'
              className='mt-0.5 inline-block break-all rounded text-xs text-foreground-muted underline-offset-2 hover:text-foreground hover:underline'
            >
              {shortUrl(monitor.url)}
              <span className='sr-only'> {t('statuspage.newTab')}</span>
            </a>
          )}
        </div>
        <StateLabel tone={tone} label={stateLabel} asOf={state === 'none' ? null : asOf} />
      </div>

      {state !== 'none' && (
        <>
          {(error || state === 'slow') && (
            <p className='mt-2 text-sm text-foreground-muted'>
              {error ??
                t('statuspage.monitors.slowNote', { limit: formatMs(monitor.slowMs, lang) })}
            </p>
          )}
          <dl className='mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4 md:grid-cols-2'>
            <Stat label={t('statuspage.monitors.response')}>
              {formatMs(monitor.latencyMs, lang)}
            </Stat>
            <Stat label={t('statuspage.monitors.uptime24h')}>
              {formatPct(monitor.uptime?.['24h']?.ratio, lang)}
            </Stat>
            <Stat label={t('statuspage.monitors.uptime7d')}>
              {formatPct(monitor.uptime?.['7d']?.ratio, lang)}
            </Stat>
            <Stat label={t('statuspage.monitors.percentiles')}>
              {formatMs(monitor.latency24h?.p50, lang)} / {formatMs(monitor.latency24h?.p95, lang)}
            </Stat>
          </dl>
          <div className='mt-4'>
            <p className='mb-1 text-xs text-foreground-muted'>{t('statuspage.monitors.trend')}</p>
            <Sparkline
              points={seriesOf(samples, monitor.id, now - DAY)}
              from={now - DAY}
              to={now}
            />
          </div>
        </>
      )}
    </li>
  );
};

const Monitors = ({ data, now, stale }) => {
  const { t } = useI18n();
  const monitors = data.phase === 'ready' ? data.summary.monitors : configuredMonitors;
  return (
    <section aria-labelledby='monitors-title' className='mt-12'>
      <h2 id='monitors-title' className='text-2xl font-bold text-foreground'>
        {t('statuspage.monitors.title')}
      </h2>
      <p className='mt-1 max-w-prose text-sm text-foreground-muted'>
        {t('statuspage.monitors.lead')}
      </p>
      {data.phase === 'ready' && data.summary.history?.loaded === false && (
        <p className='mt-3 max-w-prose text-sm text-foreground-muted'>
          {t('statuspage.monitors.historyMissing')}
        </p>
      )}
      {data.phase !== 'loading' && (
        <ul className='mt-5 grid gap-4 md:grid-cols-2'>
          {monitors.map((monitor) => (
            <MonitorCard
              key={monitor.id ?? monitor.name}
              monitor={monitor}
              samples={data.samples}
              now={now}
              asOf={stale ? data.summary.generatedAt : null}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export default Monitors;
