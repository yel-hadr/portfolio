import React from 'react';

const ErrorFallback = ({ error, resetErrorBoundary, sectionName }) => {
  const is3DSection = ['hero', 'about', 'tech', 'works', 'contact'].includes(sectionName);
  
  return (
    <div 
      role="alert" 
      className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-black-100 rounded-2xl"
    >
      <h2 className="text-2xl font-bold text-white mb-4">
        Something went wrong
      </h2>
      {is3DSection ? (
        <>
          <p className="text-secondary mb-6 text-center max-w-md">
            We're sorry, but the 3D content failed to load. This could be due to:
          </p>
          <ul className="text-secondary mb-6 space-y-2">
            <li>• WebGL not supported in your browser</li>
            <li>• Outdated graphics drivers</li>
            <li>• Hardware acceleration disabled</li>
          </ul>
        </>
      ) : (
        <p className="text-secondary mb-6 text-center max-w-md">
          We're sorry, but this section failed to load. Please try again.
        </p>
      )}
      <button
        onClick={resetErrorBoundary}
        className="bg-tertiary py-3 px-8 rounded-xl text-white font-bold hover:bg-tertiary/80 transition-colors"
        aria-label="Try again"
      >
        Try Again
      </button>
      {error && (
        <details className="mt-6 text-xs text-secondary max-w-lg">
          <summary className="cursor-pointer">Error details (for developers)</summary>
          <pre className="mt-2 p-4 bg-black-90 rounded overflow-auto max-h-40">
            {error.message}
          </pre>
        </details>
      )}
    </div>
  );
};

export default ErrorFallback;
