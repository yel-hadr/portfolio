import { motion } from 'framer-motion';

const WebGLFallback = ({ onRetry }) => {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md text-center"
      >
        <div className="mb-6">
          <svg
            aria-hidden="true"
            className="w-20 h-20 mx-auto mb-4 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h1 className="text-3xl font-bold mb-2">Hardware acceleration required</h1>
          <p className="text-foreground-muted">
            This 3D portfolio needs WebGL, which isn&apos;t available on your current device or browser.
          </p>
        </div>

        <div className="p-6 bg-surface rounded-3xl border border-line mb-6 text-left">
          <h2 className="text-xl font-semibold mb-3">What you&apos;re missing</h2>
          <ul className="space-y-2 text-foreground-muted list-disc pl-5">
            <li>Interactive 3D computer model showcasing technical skills</li>
            <li>Real-time animated Earth visualization</li>
            <li>Dynamic technology icon showcase with 3D effects</li>
          </ul>
        </div>

        <div className="space-y-4">
          <div className="p-6 bg-surface rounded-3xl border border-line text-left">
            <h2 className="font-semibold mb-2">Try these solutions</h2>
            <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
              <li>Enable hardware acceleration in your browser settings</li>
              <li>Update your graphics drivers</li>
              <li>Try a different browser (Chrome, Firefox, Edge)</li>
              <li>Check if WebGL is enabled in your browser</li>
            </ol>
          </div>

          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-primary hover:bg-primary-400 text-background font-semibold rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Retry detection
            </button>
          )}
        </div>
      </motion.div>
    </main>
  );
};

export default WebGLFallback;
