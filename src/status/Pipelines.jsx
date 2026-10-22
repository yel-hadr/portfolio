import { useI18n } from '../i18n/context';
import StateLabel from './StateLabel';
import { PIPELINE_TONE } from './tones';
import {
  dateTime,
  displayName,
  formatDuration,
  formatPct,
  isGithubUrl,
  relativeTime,
} from './format';

const Row = ({ label, children }) => (
  <div className='flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-line py-2'>
    <dt className='text-foreground-muted'>{label}</dt>
    <dd className='text-right font-medium text-foreground'>{children}</dd>
  </div>
);

const When = ({ iso, now }) => {
  const { t, lang } = useI18n();
  return (
    <time dateTime={iso} title={dateTime(iso, lang)}>
      {relativeTime(iso, lang, now, t('statuspage.justNow'))}
    </time>
  );
};

const PipelineCard = ({ pipeline, now, asOf }) => {
  const { t, lang } = useI18n();
  const tone = PIPELINE_TONE[pipeline.state] ?? 'neutral';
  const run = pipeline.lastCompletedRun;
  const rate = pipeline.successRate;
  const runUrl = isGithubUrl(run?.url) ? run.url : null;
  const actionsUrl = isGithubUrl(pipeline.url) ? pipeline.url : null;

  return (
    <li className='card-glass flex flex-col p-5'>
      <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-2'>
        <div className='min-w-0'>
          <h3 className='min-w-0 font-semibold text-foreground [overflow-wrap:anywhere]'>
            {displayName(t, pipeline)}
          </h3>
          <p className='text-xs text-foreground-muted [overflow-wrap:anywhere]'>
            {pipeline.repo}
            {pipeline.branch && (
              <> · {t('statuspage.pipelines.branch', { branch: pipeline.branch })}</>
            )}
          </p>
        </div>
        <StateLabel tone={tone} label={t(`statuspage.pipelines.${pipeline.state}`)} asOf={asOf} />
      </div>

      {pipeline.inProgress && (
        <p className='mt-2 text-sm text-info'>{t('statuspage.pipelines.running')}</p>
      )}
      {!pipeline.affectsOverall && (
        <p className='mt-2 text-xs text-foreground-muted'>{t('statuspage.pipelines.notCounted')}</p>
      )}

      {pipeline.error ? (
        <p className='mt-3 text-sm text-foreground-muted'>
          {t('statuspage.pipelines.unavailable')}
        </p>
      ) : (
        <dl className='mt-3 text-sm'>
          <Row label={t('statuspage.pipelines.lastRun')}>
            {run ? (
              <>
                {t(`statuspage.pipelines.conclusion.${run.conclusion}`)},{' '}
                <time dateTime={run.updatedAt} title={dateTime(run.updatedAt, lang)}>
                  {t('statuspage.pipelines.finished', {
                    time: relativeTime(run.updatedAt, lang, now, t('statuspage.justNow')),
                  })}
                </time>
              </>
            ) : (
              t('statuspage.none')
            )}
          </Row>
          <Row label={t('statuspage.pipelines.duration')}>
            {formatDuration(run?.durationSeconds)}
          </Row>
          <Row label={t('statuspage.pipelines.successRate')}>
            {rate?.rate !== null && rate?.rate !== undefined
              ? t('statuspage.pipelines.successRateValue', {
                  rate: formatPct(rate.rate, lang),
                  n: rate.decisive,
                })
              : '–'}
          </Row>
          <Row label={t('statuspage.pipelines.lastSuccess')}>
            {pipeline.lastSuccessAt ? (
              <When iso={pipeline.lastSuccessAt} now={now} />
            ) : (
              t('statuspage.pipelines.noneRecent')
            )}
          </Row>
        </dl>
      )}

      {(runUrl || actionsUrl) && (
        <a
          href={runUrl ?? actionsUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='mt-auto self-start rounded pt-3 text-sm font-medium text-primary-400 underline-offset-4 hover:underline'
        >
          {runUrl
            ? t('statuspage.pipelines.viewRun', { number: run.number })
            : t('statuspage.pipelines.viewActions')}
          <span className='sr-only'> {t('statuspage.newTab')}</span>
        </a>
      )}
    </li>
  );
};

const Pipelines = ({ data, now, stale }) => {
  const { t } = useI18n();
  const pipelines = data.phase === 'ready' ? data.summary.pipelines : (data.pipelines ?? []);
  return (
    <section aria-labelledby='pipelines-title' className='mt-12'>
      <h2 id='pipelines-title' className='text-2xl font-bold text-foreground'>
        {t('statuspage.pipelines.title')}
      </h2>
      <p className='mt-1 max-w-prose text-sm text-foreground-muted'>
        {t('statuspage.pipelines.lead')}
        {data.phase === 'none' && <> {t('statuspage.pipelines.live')}</>}
      </p>
      {data.phase !== 'loading' && (
        <ul className='mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {pipelines.map((pipeline) => (
            <PipelineCard
              key={pipeline.id}
              pipeline={pipeline}
              now={now}
              asOf={stale ? data.summary.generatedAt : null}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export default Pipelines;
