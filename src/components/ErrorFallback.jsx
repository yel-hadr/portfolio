// Sections that render a 3D scene; their failures get WebGL troubleshooting tips.
const SECTIONS_WITH_3D = ['hero', 'about', 'tech', 'contact'];

const ErrorFallback = ({ error, resetErrorBoundary, sectionName }) => {
  const is3DSection = SECTIONS_WITH_3D.includes(sectionName);

  return (
    <div
      role="alert"
      className="max-w-7xl mx-auto my-10 flex flex-col items-center justify-center min-h-[25rem] p-8 bg-surface border border-line rounded-3xl"
    >
      <h2 className="text-2xl font-bold text-foreground mb-4">This section failed to load</h2>
      {is3DSection ? (
        <>
          <p className="text-foreground-muted mb-6 text-center max-w-md">
            The 3D content in this section couldn&apos;t load. Common causes:
          </p>
          <ul className="text-foreground-muted mb-6 space-y-2 list-disc pl-5">
            <li>WebGL is not supported in your browser</li>
            <li>Graphics drivers are outdated</li>
            <li>Hardware acceleration is turned off</li>
          </ul>
        </>
      ) : (
        <p className="text-foreground-muted mb-6 text-center max-w-md">Reload the section to try again.</p>
      )}
      <button
        onClick={resetErrorBoundary}
        className="bg-surface-raised border border-line-strong py-3 px-8 rounded-xl text-foreground font-bold hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Reload section
      </button>
      {error && (
        <details className="mt-6 text-xs text-foreground-muted max-w-lg">
          <summary className="cursor-pointer">Error details (for developers)</summary>
          <pre className="mt-2 p-4 bg-background rounded-xl overflow-auto max-h-40">{error.message}</pre>
        </details>
      )}
    </div>
  );
};

export default ErrorFallback;
