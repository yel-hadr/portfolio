import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { View } from "@react-three/drei";
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
  ErrorBoundary,
  CanvasErrorBoundary,
  WebGLFallback,
  LoadingProgress,
  Footer,
} from "./components";
import { useWebGL } from "./hooks/useWebGL";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";

function App() {
  const { supported: glSupported } = useWebGL();

  // reducedMotion="user": framer-motion drops transform animations (keeps opacity)
  // when the OS asks for reduced motion. Wraps the fallback page too.
  return (
    <MotionConfig reducedMotion="user">
      {glSupported ? (
        <BrowserRouter
          basename={import.meta.env.BASE_URL}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppContent />
        </BrowserRouter>
      ) : (
        <WebGLFallback />
      )}
    </MotionConfig>
  );
}

// With frameloop="demand" (reduced motion) nothing animates, but the fixed canvas still has
// to redraw when the page scrolls so each View follows its DOM box. Two frames: drei draws a
// view one frame after it reports entering the screen.
const InvalidateOnScroll = () => {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const onChange = () => invalidate(2);
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [invalidate]);
  return null;
};

const AppContent = () => {
  const reduced = usePrefersReducedMotion();

  return (
    <div id="top" className="relative bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:border-2 focus:border-transparent focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-background"
      >
        Skip to content
      </a>

      <LoadingProgress />

      {/* Hero backdrop. The image is opaque, so it sits below the canvas or it would hide the 3D. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-screen bg-hero-pattern bg-cover bg-no-repeat bg-center"
      />

      {/* One WebGL context for every 3D scene: each <SceneView> in the page tunnels its
          scene into <View.Port />. Fixed behind the content, decorative for assistive tech.
          If the renderer cannot be created, the boundary drops only the 3D layer. */}
      <CanvasErrorBoundary sectionType="canvas">
        <Canvas
          style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
          frameloop={reduced ? "demand" : "always"}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          aria-hidden="true"
          onCreated={({ gl, invalidate }) => {
            // Redraw once the GPU hands the context back after a loss
            gl.domElement.addEventListener("webglcontextrestored", () => invalidate());
          }}
        >
          <View.Port />
          {reduced && <InvalidateOnScroll />}
        </Canvas>
      </CanvasErrorBoundary>

      {/* Star field behind everything (drawn first, index 1) */}
      <SceneView sectionType="stars" index={1} className="fixed inset-0 pointer-events-none">
        <Stars />
      </SceneView>

      <div className="relative z-10">
        <Navbar />

        <main id="main" tabIndex={-1}>
          <ErrorBoundary sectionName="hero">
            <Hero />
          </ErrorBoundary>

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
};

export default App;
