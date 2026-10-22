import { useEffect, useState } from 'react';

import { useI18n } from '../i18n/context';
import Banner from './Banner';
import Header from './Header';
import Metrics from './Metrics';
import Monitors from './Monitors';
import Pipelines from './Pipelines';
import { STALE_MS } from './format';
import { useStatusData } from './useStatusData';

const LINK = 'rounded font-medium text-primary-400 underline-offset-4 hover:underline';

// The clock behind every "X minutes ago" and the staleness check
const useNow = (ms = 60 * 1000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
};

const ApiLinks = () => {
  const { t } = useI18n();
  const base = import.meta.env.BASE_URL;
  const external = [
    ['source', 'https://github.com/yel-hadr/portfolio/blob/main/scripts/status/check.mjs'],
    ['workflow', 'https://github.com/yel-hadr/portfolio/actions/workflows/status.yml'],
  ];
  return (
    <section aria-labelledby='api-title' className='mt-12'>
      <h2 id='api-title' className='text-2xl font-bold text-foreground'>
        {t('statuspage.api.title')}
      </h2>
      <p className='mt-1 max-w-prose text-sm text-foreground-muted'>{t('statuspage.api.body')}</p>
      <ul className='mt-4 space-y-2 text-sm'>
        <li>
          <a href={`${base}status.json`} className={LINK}>
            <code className='font-mono'>/status.json</code>
          </a>
          <span className='text-foreground-muted'> · {t('statuspage.api.summary')}</span>
        </li>
        <li>
          <a href={`${base}status/history.json`} className={LINK}>
            <code className='font-mono'>/status/history.json</code>
          </a>
          <span className='text-foreground-muted'> · {t('statuspage.api.history')}</span>
        </li>
        {external.map(([key, href]) => (
          <li key={key}>
            <a href={href} target='_blank' rel='noopener noreferrer' className={LINK}>
              {t(`statuspage.api.${key}`)}
              <span className='sr-only'> {t('statuspage.newTab')}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

const StatusApp = () => {
  const { t } = useI18n();
  const data = useStatusData();
  const now = useNow();
  // Older than the monitor's stale threshold: every state on the page is shown as last known
  const stale = data.phase === 'ready' && now - Date.parse(data.summary.generatedAt) > STALE_MS;

  return (
    <div className='min-h-screen bg-background'>
      <a
        href='#main'
        className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-on-primary'
      >
        {t('statuspage.skipLink')}
      </a>
      <Header />
      <main id='main' tabIndex={-1} className='mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-8 sm:pt-12'>
        <a href={import.meta.env.BASE_URL} className={`text-sm ${LINK}`}>
          <span aria-hidden='true'>← </span>
          {t('statuspage.back')}
        </a>
        <h1 className='mt-4 text-4xl font-black tracking-tight text-foreground sm:text-5xl'>
          {t('statuspage.title')}
        </h1>
        <p className='mb-8 mt-3 max-w-prose leading-relaxed text-foreground-muted'>
          {t('statuspage.lead')}
        </p>

        <Banner data={data} now={now} stale={stale} />
        <Monitors data={data} now={now} stale={stale} />
        <Pipelines data={data} now={now} stale={stale} />
        <Metrics data={data} now={now} />
        <ApiLinks />
      </main>
    </div>
  );
};

export default StatusApp;
