import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';

import {
  About,
  Contact,
  Experience,
  Hero,
  Navbar,
  Tech,
  Works,
  Education,
  WavesBackground,
  Scene3D,
  ErrorBoundary,
  CanvasErrorBoundary,
  WebGLFallback,
  Footer,
  Til,
} from './components';
import { WebGLContext } from './components/canvas/WebGLContext';
import { useWebGL } from './hooks/useWebGL';
import I18nProvider from './i18n/I18nProvider';
import { useI18n } from './i18n/context';
import ThemeProvider from './theme/ThemeProvider';

// The terminal overlay loads on first open
const Terminal = lazy(() => import('./components/terminal/Terminal'));

function App() {
  const { supported } = useWebGL();
  // The probe can pass while the renderer or the 3D chunk still fails later; treat that the
  // same as no WebGL so every SceneView shows its static fallback and the notice appears.
  const [canvasFailed, setCanvasFailed] = useState(false);
  const webgl = supported && !canvasFailed;

  // reducedMotion="user": framer-motion drops transform animations (keeps opacity)
  // when the OS asks for reduced motion.
  return (
    <ThemeProvider>
      <I18nProvider>
        <MotionConfig reducedMotion='user'>
          <WebGLContext.Provider value={webgl}>
            <AppContent
              webgl={webgl}
              supported={supported}
              onCanvasError={() => setCanvasFailed(true)}
            />
          </WebGLContext.Provider>
        </MotionConfig>
      </I18nProvider>
    </ThemeProvider>
  );
}

const AppContent = ({ webgl, supported, onCanvasError }) => {
  const { t } = useI18n();
  const [terminalOpen, setTerminalOpen] = useState(false);
  // Focus returns here when the terminal closes
  const terminalOpener = useRef(null);

  const openTerminal = useCallback(() => {
    terminalOpener.current = document.activeElement;
    setTerminalOpen(true);
  }, []);
  const closeTerminal = useCallback(() => {
    setTerminalOpen(false);
    requestAnimationFrame(() => terminalOpener.current?.focus?.());
  }, []);

  // Ctrl+` opens the terminal from anywhere
  useEffect(() => {
    const onKeyDown = (e) => {
      // Ctrl+` (the physical Backquote key, so it also works on AZERTY). A modifier is required,
      // so typing never triggers it (WCAG 2.1.4 Character Key Shortcuts)
      if (e.code !== 'Backquote' || !e.ctrlKey || e.altKey || e.shiftKey || terminalOpen) return;
      // Another dialog (an architecture diagram) owns the keyboard while it is open
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      openTerminal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openTerminal, terminalOpen]);

  return (
    // overflow-clip: the 3D layer follows the scroll position and would otherwise extend the
    // page below its last section (fixed descendants are not clipped)
    <div id='top' className='relative overflow-clip bg-background'>
      <a
        href='#main'
        className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:border-2 focus:border-transparent focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-on-primary'
      >
        {t('skipLink')}
      </a>

      {/* Interactive waves (2D canvas, fixed behind everything; not a WebGL context) */}
      <WavesBackground />

      {/* The 3D layer (one Canvas, lazily loaded). Without WebGL2 it is skipped and every
        SceneView renders its static fallback. If the renderer or its chunk fails, the
        boundary drops only the 3D layer. */}
      {webgl && (
        <CanvasErrorBoundary sectionType='canvas' onError={onCanvasError}>
          <Suspense fallback={null}>
            <Scene3D />
          </Suspense>
        </CanvasErrorBoundary>
      )}

      <div className='relative z-10'>
        <Navbar onOpenTerminal={openTerminal} />

        <main id='main' tabIndex={-1}>
          <ErrorBoundary sectionName='hero'>
            <Hero />
          </ErrorBoundary>

          {/* A live region mounted from the start, so a late 3D failure is announced */}
          <div role='status'>
            {!webgl && <WebGLFallback reason={supported ? 'failed' : 'unsupported'} />}
          </div>

          <ErrorBoundary sectionName='about'>
            <About />
          </ErrorBoundary>

          <ErrorBoundary sectionName='experience'>
            <Experience />
          </ErrorBoundary>

          <ErrorBoundary sectionName='tech'>
            <Tech />
          </ErrorBoundary>

          <ErrorBoundary sectionName='works'>
            <Works />
          </ErrorBoundary>

          <ErrorBoundary sectionName='education'>
            <Education />
          </ErrorBoundary>

          <ErrorBoundary sectionName='til'>
            <Til />
          </ErrorBoundary>

          <ErrorBoundary sectionName='contact'>
            <Contact />
          </ErrorBoundary>
        </main>

        <Footer />
      </div>

      {terminalOpen && (
        <Suspense fallback={null}>
          <Terminal onClose={closeTerminal} />
        </Suspense>
      )}
    </div>
  );
};

export default App;
