import { styles } from '../styles';
import { useI18n } from '../i18n/context';

/**
 * Shown when the browser has no WebGL2 (`reason='unsupported'`) or the 3D layer failed later
 * (`reason='failed'`): the portfolio still renders as plain content, and this notice explains
 * why the 3D scenes are missing. App renders it inside an always-mounted role=status region.
 */
const WebGLFallback = ({ reason = 'unsupported', onRetry }) => {
  const { t } = useI18n();
  return (
    <section aria-labelledby='webgl-title' className={`${styles.container} py-10`}>
      <div className={`${styles.card} max-w-3xl`}>
        <h2 id='webgl-title' className='text-foreground text-xl font-bold'>
          {t('webgl.title')}
        </h2>
        <p className='mt-2 text-foreground-muted leading-relaxed'>
          {reason === 'failed' ? t('webgl.failed') : t('webgl.unsupported')} {t('webgl.rest')}
        </p>
        <details className='mt-4 text-foreground-muted'>
          <summary className='cursor-pointer font-medium text-foreground'>
            {t('webgl.howTo')}
          </summary>
          <ol className='mt-3 space-y-1 list-decimal pl-5 text-sm'>
            {t('webgl.steps').map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
        {onRetry && (
          <button
            onClick={onRetry}
            className='mt-6 px-6 py-3 border-2 border-transparent bg-primary hover:bg-primary-hover text-on-primary font-semibold rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
          >
            {t('webgl.retry')}
          </button>
        )}
      </div>
    </section>
  );
};

export default WebGLFallback;
