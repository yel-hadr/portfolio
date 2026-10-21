import { styles } from '../styles';

/**
 * Shown when the browser has no WebGL2: the whole portfolio still renders as plain content,
 * and this notice explains why the 3D scenes are missing and how to enable them.
 */
const WebGLFallback = ({ onRetry }) => (
  <section role='status' aria-labelledby='webgl-title' className={`${styles.container} py-10`}>
    <div className={`${styles.card} max-w-3xl`}>
      <h2 id='webgl-title' className='text-foreground text-xl font-bold'>
        3D scenes are turned off
      </h2>
      <p className='mt-2 text-foreground-muted leading-relaxed'>
        Your browser or device doesn&apos;t support WebGL 2, so the interactive 3D globe and
        technology icons aren&apos;t shown. Everything else on this page works as usual.
      </p>
      <details className='mt-4 text-foreground-muted'>
        <summary className='cursor-pointer font-medium text-foreground'>
          How to turn them on
        </summary>
        <ol className='mt-3 space-y-1 list-decimal pl-5 text-sm'>
          <li>Enable hardware acceleration in your browser settings</li>
          <li>Update your graphics drivers</li>
          <li>Try a different browser (Chrome, Firefox, Edge, Safari)</li>
          <li>Check that WebGL is enabled in your browser</li>
        </ol>
      </details>
      {onRetry && (
        <button
          onClick={onRetry}
          className='mt-6 px-6 py-3 border-2 border-transparent bg-primary hover:bg-primary-400 text-background font-semibold rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
        >
          Retry detection
        </button>
      )}
    </div>
  </section>
);

export default WebGLFallback;
