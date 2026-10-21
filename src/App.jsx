import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";

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
  WebGLFallback,
  LoadingProgress,
} from "./components";
import { useWebGL } from "./hooks/useWebGL";

function App() {
  const { supported: glSupported } = useWebGL();

  if (!glSupported) {
    return <WebGLFallback />;
  }

  return (
    <BrowserRouter
      basename={import.meta.env.BASE_URL}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppContent />
    </BrowserRouter>
  );
}

// With frameloop="demand" (reduced motion) nothing animates, but the fixed canvas still has
// to redraw when the page scrolls so each View follows its DOM box.
const InvalidateOnScroll = () => {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const onChange = () => invalidate();
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
  const reduced = useReducedMotion();

  return (
    <div className="relative bg-primary">
      <LoadingProgress />

      {/* Hero backdrop. The image is opaque, so it sits below the canvas or it would hide the 3D. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-screen bg-hero-pattern bg-cover bg-no-repeat bg-center"
      />

      {/* One WebGL context for every 3D scene: each <SceneView> in the page tunnels its
          scene into <View.Port />. Fixed behind the content, decorative for assistive tech. */}
      <Canvas
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
        frameloop={reduced ? "demand" : "always"}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        aria-hidden="true"
      >
        <View.Port />
        {reduced && <InvalidateOnScroll />}
      </Canvas>

      {/* Star field behind everything (drawn first, index 1) */}
      <SceneView sectionType="stars" index={1} className="fixed inset-0 pointer-events-none">
        <Stars />
      </SceneView>

      <div className="relative z-10">
        <Navbar />
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
      </div>
    </div>
  );
};

export default App;
