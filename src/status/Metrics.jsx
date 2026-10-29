import { useState } from 'react';

import { useI18n } from '../i18n/context';
import ResponseChart from './ResponseChart';
import { TONE_TEXT, uptimeTone } from './tones';
import { DAY, dayStart, displayName, formatPct, seriesOf, shortDay, statsOf } from './format';

// Optional, set at build time from a repository variable (see deploy.yml). Only an https URL is
// embedded.
const GRAFANA_URL = /^https:\/\//.test(import.meta.env.VITE_GRAFANA_DASHBOARD_URL ?? '')
  ? import.meta.env.VITE_GRAFANA_DASHBOARD_URL
  : '';

const Grafana = () => {
  const { t } = useI18n();
  return (
    <div className='mt-5'>
      <p className='text-sm text-foreground-muted'>{t('statuspage.metrics.grafanaNote')}</p>
      <iframe
        src={GRAFANA_URL}
        title={t('statuspage.metrics.grafanaTitle')}
        loading='lazy'
        referrerPolicy='strict-origin-when-cross-origin'
        className='mt-3 h-96 w-full rounded-2xl border border-line bg-surface lg:h-[36rem]'
      />
      <a
        href={GRAFANA_URL}
        target='_blank'
        rel='noopener noreferrer'
        className='mt-3 inline-block rounded-sm text-sm font-medium text-primary-400 underline-offset-4 hover:underline'
      >
        {t('statuspage.metrics.grafanaOpen')}
        <span className='sr-only'> {t('statuspage.newTab')}</span>
      </a>
    </div>
  );
};

const ServicePicker = ({ monitors, selected, onSelect }) => {
  const { t } = useI18n();
  return (
    <div
      role='group'
      aria-label={t('statuspage.metrics.pick')}
      className='flex flex-wrap gap-2 text-sm font-medium'
    >
      {monitors.map((m) => (
        <button
          key={m.id}
          type='button'
          aria-pressed={selected === m.id}
          onClick={() => onSelect(m.id)}
          className={`rounded-xl border px-3 py-1.5 transition-colors [overflow-wrap:anywhere] ${
            selected === m.id
              ? 'border-transparent bg-primary text-on-primary forced-colors:underline'
              : 'border-line-strong text-foreground-muted hover:text-foreground'
          }`}
        >
          {displayName(t, m)}
        </button>
      ))}
    </div>
  );
};

const UptimeTable = ({ monitors, samples, now }) => {
  const { t, lang } = useI18n();
  const days = Array.from({ length: 7 }, (_, i) => dayStart(now, 6 - i));
  return (
    <div
      role='region'
      aria-label={t('statuspage.metrics.scrollRegion')}
      tabIndex={0}
      className='mt-3 overflow-x-auto rounded-sm'
    >
      <table className='w-full min-w-[34rem] text-left text-sm tabular-nums'>
        <caption className='mb-2 text-left text-foreground-muted'>
          {t('statuspage.metrics.uptimeCaption')}
        </caption>
        <thead className='text-xs text-foreground-muted'>
          <tr>
            <th scope='col' className='py-1.5 pr-3 font-medium'>
              {t('statuspage.metrics.service')}
            </th>
            {days.map((day) => (
              <th key={day} scope='col' className='py-1.5 pr-3 font-medium'>
                {shortDay(day, lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monitors.map((m) => {
            const points = seriesOf(samples, m.id, days[0]);
            return (
              <tr key={m.id} className='border-t border-line'>
                <th scope='row' className='py-2 pr-3 font-medium text-foreground'>
                  {displayName(t, m)}
                </th>
                {days.map((day) => {
                  const { uptime } = statsOf(points.filter((p) => p.t >= day && p.t < day + DAY));
                  return (
                    <td
                      key={day}
                      className={`py-2 pr-3 font-semibold ${TONE_TEXT[uptimeTone(uptime)]}`}
                    >
                      {formatPct(uptime, lang)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Metrics = ({ data, now }) => {
  const { t } = useI18n();
  const monitors = data.phase === 'ready' ? data.summary.monitors : [];
  const [picked, setPicked] = useState(null);
  const selected = monitors.find((m) => m.id === picked) ?? monitors[0];
  const hasHistory = data.phase === 'ready' && data.samples?.length > 0;

  return (
    <section aria-labelledby='metrics-title' className='mt-12'>
      <h2 id='metrics-title' className='text-2xl font-bold text-foreground'>
        {t('statuspage.metrics.title')}
      </h2>
      {GRAFANA_URL ? (
        <Grafana />
      ) : (
        <>
          <p className='mt-1 max-w-prose text-sm text-foreground-muted'>
            {t('statuspage.metrics.ownNote')}
          </p>
          {data.phase === 'loading' ? null : hasHistory && selected ? (
            <>
              <div className='card-glass mt-5 p-5'>
                <h3 className='font-semibold text-foreground'>
                  {t('statuspage.metrics.responseTitle')}
                </h3>
                <div className='mt-3'>
                  <ServicePicker monitors={monitors} selected={selected.id} onSelect={setPicked} />
                </div>
                <div className='mt-4'>
                  <ResponseChart
                    key={selected.id}
                    monitor={selected}
                    name={displayName(t, selected)}
                    samples={data.samples}
                    now={now}
                  />
                </div>
              </div>
              <div className='card-glass mt-4 p-5'>
                <h3 className='font-semibold text-foreground'>
                  {t('statuspage.metrics.uptimeTitle')}
                </h3>
                <UptimeTable monitors={monitors} samples={data.samples} now={now} />
              </div>
            </>
          ) : (
            <p className='mt-4 text-sm text-foreground-muted'>
              {/* A summary without its history file: the file failed to load (or is not there),
                  which is not the same as a monitor that has not run yet */}
              {t(
                data.phase === 'ready' && !Array.isArray(data.samples)
                  ? 'statuspage.metrics.historyFailed'
                  : 'statuspage.metrics.noHistory'
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default Metrics;
