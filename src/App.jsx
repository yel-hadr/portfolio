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
  Blog,
} from './components';
import { PageCanvasContext } from './components/canvas/PageCanvasContext';
import { WebGLContext } from './components/canvas/WebGLContext';
import { useWebGL } from './hooks/useWebGL';
import I18nProvider from './i18n/I18nProvider';
import { useI18n } from './i18n/context';
import ThemeProvider from './theme/ThemeProvider';
import { track } from './utils/analytics';

// The terminal overlay loads on first open
const loadTerminal = () => import('./components/terminal/Terminal');
const Terminal = lazy(loadTerminal);
// The games dialog (Packet Snake is a further chunk inside it) loads on first open
const GameMenu = lazy(() => import('./components/Games/GameMenu'));

function App() {
  const { supported } = useWebGL();
  // The probe can pass while the renderer or the 3D chunk still fails later; treat that the
  // same as no WebGL so every SceneView shows its static fallback and the notice appears.
  const [canvasFailed, setCanvasFailed] = useState(false);
  const webgl = supported && !canvasFailed;
  // A live demo's own Canvas is open: the page Canvas steps aside (see PageCanvasContext)
  const [pageCanvasPaused, setPageCanvasPaused] = useState(false);

  // reducedMotion="user": framer-motion drops transform animations (keeps opacity)
  // when the OS asks for reduced motion.
  return (
    <ThemeProvider>
      <I18nProvider>
        <MotionConfig reducedMotion='user'>
          <WebGLContext.Provider value={webgl}>
            <PageCanvasContext.Provider value={setPageCanvasPaused}>
              <AppContent
                webgl={webgl}
                showCanvas={webgl && !pageCanvasPaused}
                supported={supported}
                onCanvasError={() => setCanvasFailed(true)}
              />
            </PageCanvasContext.Provider>
          </WebGLContext.Provider>
        </MotionConfig>
      </I18nProvider>
    </ThemeProvider>
  );
}

const AppContent = ({ webgl, showCanvas, supported, onCanvasError }) => {
  const { t } = useI18n();
  const [terminalOpen, setTerminalOpen] = useState(false);
  // A command the terminal runs as it opens (the games menu starts the challenge this way)
  const [terminalCommand, setTerminalCommand] = useState(null);
  // Focus returns here when the terminal closes
  const terminalOpener = useRef(null);
  const [gamesOpen, setGamesOpen] = useState(false);
  const gamesOpener = useRef(null);

  const openTerminal = useCallback(() => {
    terminalOpener.current = document.activeElement;
    setTerminalCommand(null);
    setTerminalOpen(true);
    track('terminal-open');
  }, []);

  const openGames = useCallback(() => {
    gamesOpener.current = document.activeElement;
    setGamesOpen(true);
    track('games-open');
  }, []);
  const closeGames = useCallback(() => {
    setGamesOpen(false);
    requestAnimationFrame(() => gamesOpener.current?.focus?.());
  }, []);
  // From the games menu: the terminal replaces it, and closing the terminal returns focus to the
  // footer button that opened the menu
  const playTerminalChallenge = useCallback(() => {
    setGamesOpen(false);
    terminalOpener.current = gamesOpener.current;
    setTerminalCommand('game');
    setTerminalOpen(true);
    track('terminal-open');
  }, []);
  const closeTerminal = useCallback(() => {
    setTerminalOpen(false);
    requestAnimationFrame(() => terminalOpener.current?.focus?.());
  }, []);

  // Fetch the terminal chunk (~10 KB gzip) once the page is idle, so the first open is instant
  // instead of waiting on the network. Skipped when the visitor asked to save data.
  useEffect(() => {
    if (navigator.connection?.saveData) return undefined;
    const idle = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 2500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => loadTerminal().catch(() => {}), { timeout: 5000 });
    return () => cancel(handle);
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
      <WavesBackground paused={!showCanvas && webgl} />

      {/* The 3D layer (one Canvas, lazily loaded). Without WebGL2 it is skipped and every
        SceneView renders its static fallback. If the renderer or its chunk fails, the
        boundary drops only the 3D layer. */}
      {showCanvas && (
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

          <ErrorBoundary sectionName='blog'>
            <Blog />
          </ErrorBoundary>

          <ErrorBoundary sectionName='contact'>
            <Contact />
          </ErrorBoundary>
        </main>

        <Footer onOpenGames={openGames} />
      </div>

      {terminalOpen && (
        <Suspense fallback={null}>
          <Terminal onClose={closeTerminal} initialCommand={terminalCommand} />
        </Suspense>
      )}

      {gamesOpen && (
        <Suspense fallback={null}>
          <GameMenu onClose={closeGames} onPlayTerminal={playTerminalChallenge} />
        </Suspense>
      )}
    </div>
  );
};

export default App;
