const ErrorFallback = ({ error, resetErrorBoundary, sectionName }) => {
  return (
    // Keeps the section id so nav links still land here (sectionName values match section ids)
    <section
      id={sectionName}
      aria-labelledby={`${sectionName}-error`}
      className='max-w-7xl mx-auto my-10 min-h-[25rem] p-8 bg-surface border border-line rounded-3xl scroll-mt-20 flex'
    >
      <div role='alert' className='m-auto flex flex-col items-center justify-center'>
        <h2 id={`${sectionName}-error`} className='text-2xl font-bold text-foreground mb-4'>
          The {sectionName} section failed to load
        </h2>
        {/* 3D failures never reach here: SceneView's own boundary swaps in a static fallback */}
        <p className='text-foreground-muted mb-6 text-center max-w-md'>
          Reload the section to try again.
        </p>
        <button
          onClick={resetErrorBoundary}
          className='bg-surface-raised border border-line-strong py-3 px-8 rounded-xl text-foreground font-bold hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        >
          Reload section
        </button>
        {error && (
          <details className='mt-6 text-xs text-foreground-muted max-w-lg'>
            <summary className='cursor-pointer'>Error details (for developers)</summary>
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
