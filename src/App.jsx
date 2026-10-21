import { Suspense } from "react";
import { MotionConfig } from "framer-motion";

import {
  About,
  Contact,
  Experience,
  Hero,
  Navbar,
  Tech,
  Works,
  Stars,
  SceneView,
  Scene3D,
  ErrorBoundary,
  CanvasErrorBoundary,
  WebGLFallback,
  Footer,
} from "./components";
import { WebGLContext } from "./components/canvas/WebGLContext";
import { useWebGL } from "./hooks/useWebGL";

function App() {
  const { supported: webgl } = useWebGL();

  // reducedMotion="user": framer-motion drops transform animations (keeps opacity)
  // when the OS asks for reduced motion.
  return (
    <MotionConfig reducedMotion="user">
      <WebGLContext.Provider value={webgl}>
        <AppContent webgl={webgl} />
      </WebGLContext.Provider>
    </MotionConfig>
  );
}

const AppContent = ({ webgl }) => (
  <div id="top" className="relative bg-background">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:border-2 focus:border-transparent focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-background"
    >
      Skip to content
    </a>

    {/* Hero backdrop. The image is opaque, so it sits below the canvas or it would hide the 3D. */}
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-screen bg-hero-pattern bg-cover bg-no-repeat bg-center"
    />

    {/* The 3D layer (one Canvas, lazily loaded). Without WebGL2 it is skipped and every
        SceneView renders its static fallback. If the renderer or its chunk fails, the
        boundary drops only the 3D layer. */}
    {webgl && (
      <CanvasErrorBoundary sectionType="canvas">
        <Suspense fallback={null}>
          <Scene3D />
        </Suspense>
      </CanvasErrorBoundary>
    )}

    {/* Star field behind everything (drawn first, index 1); fixed box, so measure once */}
    <SceneView sectionType="stars" index={1} frames={1} className="fixed inset-0 pointer-events-none">
      <Stars />
    </SceneView>

    <div className="relative z-10">
      <Navbar />

      <main id="main" tabIndex={-1}>
        <ErrorBoundary sectionName="hero">
          <Hero />
        </ErrorBoundary>

        {!webgl && <WebGLFallback />}

        <ErrorBoundary sectionName="about">
          <About />
        </ErrorBoundary>

        <ErrorBoundary sectionName="experience">
          <Experience />
        </ErrorBoundary>

        <ErrorBoundary sectionName="tech">
          <Tech />
        </ErrorBoundary>

        <ErrorBoundary sectionName="works">
          <Works />
        </ErrorBoundary>

        <ErrorBoundary sectionName="contact">
          <Contact />
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  </div>
);

export default App;
