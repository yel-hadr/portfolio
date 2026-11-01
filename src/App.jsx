import { Suspense, lazy, useEffect, useEffectEvent, useRef, useState } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';

// Direct imports, not the ./components barrel: it imports every section, which would pull the
// lazy sections back into the first chunk
import { Scene3D } from './components/canvas';
import CanvasErrorBoundary from './components/CanvasErrorBoundary';
import ErrorBoundary from './components/ErrorBoundary';
import Hero from './components/Hero';
import Navbar from './components/Navbar';
import WavesBackground from './components/WavesBackground';
import WebGLFallback from './components/WebGLFallback';
import { loadScene3D } from './components/canvas/loadScene3D';
import { Near3DContext } from './components/canvas/Near3DContext';
import { PageCanvasContext } from './components/canvas/PageCanvasContext';
import { WebGLContext } from './components/canvas/WebGLContext';
import { useSpotlight } from './hooks/useSpotlight';
import { useWebGL } from './hooks/useWebGL';
import I18nProvider from './i18n/I18nProvider';
import { useI18n } from './i18n/context';
import ThemeProvider from './theme/ThemeProvider';
import { afterSettle } from './utils/afterSettle';
import { track } from './utils/analytics';

// Below the hero: the sections and the footer are their own chunks, loading with the first render
// so the first paint waits only on the navbar and the hero
const BelowFold = lazy(() => import('./components/BelowFold'));
const Footer = lazy(() => import('./components/Footer'));
// The terminal overlay loads on first open
const loadTerminal = () => import('./components/terminal/Terminal');
const Terminal = lazy(loadTerminal);
// The games dialog (Packet Snake is a further chunk inside it) loads on first open
const GameMenu = lazy(() => import('./components/Games/GameMenu'));
// Game Mode (the cub3D world full screen, with its own Canvas) loads on first open
const GameMode = lazy(() => import('./components/Cub3D/GameMode'));

function App() {
  const { supported } = useWebGL();
  // The probe can pass while the renderer or the 3D chunk still fails later; treat that the
  // same as no WebGL so every SceneView shows its static fallback and the notice appears.
  const [canvasFailed, setCanvasFailed] = useState(false);
  const webgl = supported && !canvasFailed;
  // A live demo's own Canvas is open: the page Canvas steps aside (see PageCanvasContext). A
  // count, because a demo can open from inside Game Mode, and closing it must not resume the page
  const [pageCanvasPauses, setPageCanvasPauses] = useState(0);
  const pausePageCanvas = (paused) => setPageCanvasPauses((n) => n + (paused ? 1 : -1));
  // The cards' cursor spotlight: one listener for the page, no re-renders
  useSpotlight();

  // reducedMotion="user": framer-motion drops transform animations (keeps opacity)
  // when the OS asks for reduced motion. LazyMotion with domAnimation: the m components carry only
  // the animation, variant and in-view features the site uses (no layout projection or drag), and
  // strict makes a full motion component an error
  return (
    <ThemeProvider>
      <I18nProvider>
        <LazyMotion features={domAnimation} strict>
          <MotionConfig reducedMotion='user'>
            <WebGLContext.Provider value={webgl}>
              <PageCanvasContext.Provider value={pausePageCanvas}>
                <AppContent
                  webgl={webgl}
                  showCanvas={webgl && pageCanvasPauses === 0}
                  supported={supported}
                  onCanvasError={() => setCanvasFailed(true)}
                />
              </PageCanvasContext.Provider>
            </WebGLContext.Provider>
          </MotionConfig>
        </LazyMotion>
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
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const gameModeOpener = useRef(null);

  // Handlers stay stable across renders through the React Compiler (no useCallback)
  const openTerminal = () => {
    terminalOpener.current = document.activeElement;
    setTerminalCommand(null);
    setTerminalOpen(true);
    track('terminal-open');
  };

  const openGames = () => {
    gamesOpener.current = document.activeElement;
    setGamesOpen(true);
    track('games-open');
  };
  const closeGames = () => {
    setGamesOpen(false);
    requestAnimationFrame(() => gamesOpener.current?.focus?.());
  };
  const enterGameMode = () => {
    gameModeOpener.current = document.activeElement;
    setGameModeOpen(true);
    track('game-mode-open');
  };
  const exitGameMode = () => {
    setGameModeOpen(false);
    requestAnimationFrame(() => gameModeOpener.current?.focus?.());
  };
  // From the games menu: the terminal replaces it, and closing the terminal returns focus to the
  // footer button that opened the menu
  const playTerminalChallenge = () => {
    setGamesOpen(false);
    terminalOpener.current = gamesOpener.current;
    setTerminalCommand('game');
    setTerminalOpen(true);
    track('terminal-open');
  };
  const closeTerminal = () => {
    setTerminalOpen(false);
    requestAnimationFrame(() => terminalOpener.current?.focus?.());
  };

  // Fetch the terminal chunk (~10 KB gzip) once the page has settled, so the first open is
  // instant instead of waiting on the network. Skipped when the visitor asked to save data.
  useEffect(() => {
    if (navigator.connection?.saveData) return undefined;
    return afterSettle(() => loadTerminal().catch(() => {}));
  }, []);

  // The 3D layer's first scene is in the Tech section, below the hero. Its chunk is fetched once
  // the page has settled, and the Canvas (creating the WebGL renderer is one long task) mounts once that section
  // is within a viewport of the screen, so the first paint and first input never wait on it. A
  // deep link below the hero mounts it at once; once mounted it stays
  const [near3D, setNear3D] = useState(false);
  // The sections below the hero are a lazy chunk: #tech exists once it has rendered
  const [sectionsReady, setSectionsReady] = useState(false);
  useEffect(() => {
    if (!webgl) return undefined;
    return afterSettle(() => loadScene3D().catch(() => {}));
  }, [webgl]);
  useEffect(() => {
    if (!webgl || near3D || !sectionsReady) return undefined;
    const target = document.getElementById('tech');
    if (!target || typeof IntersectionObserver === 'undefined') {
      setNear3D(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setNear3D(true),
      { rootMargin: '100% 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [webgl, near3D, sectionsReady]);

  // Ctrl+` opens the terminal from anywhere. An effect event: it reads the latest state, so the
  // listener is added once
  const onShortcut = useEffectEvent((e) => {
    // Ctrl+` (the physical Backquote key, so it also works on AZERTY). A modifier is required,
    // so typing never triggers it (WCAG 2.1.4 Character Key Shortcuts)
    if (e.code !== 'Backquote' || !e.ctrlKey || e.altKey || e.shiftKey || terminalOpen) return;
    // Another dialog (an architecture diagram) owns the keyboard while it is open
    if (document.querySelector('[aria-modal="true"]')) return;
    e.preventDefault();
    openTerminal();
  });
  useEffect(() => {
    const onKeyDown = (e) => onShortcut(e);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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

      {/* The 3D layer (one Canvas, lazily loaded, mounted as its first scene nears the screen).
        Without WebGL2 it is skipped and every SceneView renders its static fallback. If the
        renderer or its chunk fails, the boundary drops only the 3D layer. */}
      {showCanvas && near3D && (
        <CanvasErrorBoundary sectionType='canvas' onError={onCanvasError}>
          <Suspense fallback={null}>
            <Scene3D />
          </Suspense>
        </CanvasErrorBoundary>
      )}

      {/* Outside the content's stacking context, so it stays above the 3D layer (z-20) */}
      <Navbar onOpenTerminal={openTerminal} />

      <div className='relative z-10'>
        <Near3DContext.Provider value={near3D}>
          <main id='main' tabIndex={-1}>
            <ErrorBoundary sectionName='hero'>
              <Hero onEnterGame={enterGameMode} />
            </ErrorBoundary>

            {/* A live region mounted from the start, so a late 3D failure is announced */}
            <div role='status'>
              {!webgl && <WebGLFallback reason={supported ? 'failed' : 'unsupported'} />}
            </div>

            {/* A lazy chunk that fails to load (a flaky network; a stale tab after a deploy is
                reloaded by main.jsx) drops only what it holds: an uncaught lazy() rejection
                would unmount the whole root and leave a blank page */}
            <CanvasErrorBoundary sectionType='sections'>
              <Suspense fallback={null}>
                <BelowFold onReady={() => setSectionsReady(true)} />
              </Suspense>
            </CanvasErrorBoundary>
          </main>
        </Near3DContext.Provider>

        <CanvasErrorBoundary sectionType='footer'>
          <Suspense fallback={null}>
            <Footer onOpenGames={openGames} onEnterGame={enterGameMode} />
          </Suspense>
        </CanvasErrorBoundary>
      </div>

      {terminalOpen && (
        // As Game Mode below: a chunk that fails to load closes the overlay instead
        <CanvasErrorBoundary sectionType='terminal' onError={closeTerminal}>
          <Suspense fallback={null}>
            <Terminal onClose={closeTerminal} initialCommand={terminalCommand} />
          </Suspense>
        </CanvasErrorBoundary>
      )}

      {gamesOpen && (
        <CanvasErrorBoundary sectionType='games' onError={closeGames}>
          <Suspense fallback={null}>
            <GameMenu onClose={closeGames} onPlayTerminal={playTerminalChallenge} />
          </Suspense>
        </CanvasErrorBoundary>
      )}

      {gameModeOpen && (
        // A Game Mode chunk that fails to load closes it instead of blanking the page
        <CanvasErrorBoundary sectionType='game mode' onError={exitGameMode}>
          <Suspense fallback={null}>
            <GameMode onClose={exitGameMode} />
          </Suspense>
        </CanvasErrorBoundary>
      )}
    </div>
  );
};

export default App;
