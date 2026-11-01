import { useI18n } from '../i18n/context';

// `reloadPage`: a code chunk that failed to load (the browser keeps the failure, so rendering again
// cannot help): the whole page is reloaded instead, and the copy says so
const ErrorFallback = ({ error, resetErrorBoundary, sectionName, reloadPage = false }) => {
  const { t } = useI18n();
  // The hero holds the page's only h1; keep one when it fails
  const Heading = sectionName === 'hero' ? 'h1' : 'h2';
  return (
    // Keeps the section id so nav links still land here (sectionName values match section ids)
    <section
      id={sectionName}
      aria-labelledby={`${sectionName}-error`}
      className='max-w-7xl mx-auto my-10 min-h-[25rem] p-8 bg-surface border border-line rounded-3xl flex'
    >
      <div role='alert' className='m-auto flex flex-col items-center justify-center'>
        <Heading id={`${sectionName}-error`} className='text-2xl font-bold text-foreground mb-4'>
          {reloadPage
            ? t('error.pageTitle')
            : t('error.title', { section: t(`error.sections.${sectionName}`) })}
        </Heading>
        {/* 3D failures never reach here: SceneView's own boundary swaps in a static fallback */}
        <p className='text-foreground-muted mb-6 text-center max-w-md'>
          {t(reloadPage ? 'error.pageBody' : 'error.body')}
        </p>
        <button
          onClick={reloadPage ? () => window.location.reload() : resetErrorBoundary}
          className='bg-surface-raised border border-line-strong py-3 px-8 rounded-xl text-foreground font-bold hover:bg-surface transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus'
        >
          {t(reloadPage ? 'error.reloadPage' : 'error.reload')}
        </button>
        {error && (
          <details className='mt-6 text-xs text-foreground-muted max-w-lg'>
            <summary className='cursor-pointer'>{t('error.details')}</summary>
            <pre className='mt-2 p-4 bg-background rounded-xl overflow-auto max-h-40'>
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </section>
  );
};

export default ErrorFallback;
