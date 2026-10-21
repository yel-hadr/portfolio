import { Suspense, useState } from 'react';
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
} from './components';
import { WebGLContext } from './components/canvas/WebGLContext';
import { useWebGL } from './hooks/useWebGL';

function App() {
  const { supported } = useWebGL();
  // The probe can pass while the renderer or the 3D chunk still fails later; treat that the
  // same as no WebGL so every SceneView shows its static fallback and the notice appears.
  const [canvasFailed, setCanvasFailed] = useState(false);
  const webgl = supported && !canvasFailed;

  // reducedMotion="user": framer-motion drops transform animations (keeps opacity)
  // when the OS asks for reduced motion.
  return (
    <MotionConfig reducedMotion='user'>
      <WebGLContext.Provider value={webgl}>
        <AppContent
          webgl={webgl}
          supported={supported}
          onCanvasError={() => setCanvasFailed(true)}
        />
      </WebGLContext.Provider>
    </MotionConfig>
  );
}

const AppContent = ({ webgl, supported, onCanvasError }) => (
  <div id='top' className='relative bg-background'>
    <a
      href='#main'
      className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:border-2 focus:border-transparent focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-background'
    >
      Skip to content
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
      <Navbar />

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

        <ErrorBoundary sectionName='contact'>
          <Contact />
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  </div>
);

export default App;
