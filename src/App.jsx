import { BrowserRouter } from "react-router-dom";
import { useState, useEffect, Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { View, Preload, OrbitControls, useProgress } from "@react-three/drei";

import { 
  About, 
  Contact, 
  Experience, 
  Hero, 
  Navbar, 
  Tech, 
  Works, 
  StarsCanvas, 
  Computers,
  Earth,
  ErrorBoundary,
  WebGLFallback,
  CanvasErrorBoundary,
  LoadingProgress
} from "./components";
import { useWebGL } from "./hooks/useWebGL";

function App() {
  const { supported: glSupported, loading } = useWebGL();
  const [isMobile, setIsMobile] = useState(false);
  
  // Refs for view tracking
  const heroViewRef = useRef(null);
  const aboutViewRef = useRef(null);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobile(mediaQuery.matches);
    const handler = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-primary">
        <div className="text-white text-xl">Loading portfolio...</div>
      </div>
    );
  }

  if (!glSupported) {
    return <WebGLFallback />;
  }

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppContent 
        isMobile={isMobile}
        heroViewRef={heroViewRef}
        aboutViewRef={aboutViewRef}
      />
    </BrowserRouter>
  );
}

/**
 * AppContent - Separated component to access useProgress hook inside Canvas context
 */
const AppContent = ({ isMobile, heroViewRef, aboutViewRef }) => {
  const { progress } = useProgress();
  const showLoader = progress < 100;

  return (
    <div className="relative z-0 bg-primary">
      {/* Loading Progress Bar */}
      {showLoader && <LoadingProgress progress={progress} />}
      
      {/* Single global Canvas for all 3D content with Error Boundaries */}
      <Canvas
        className="fixed inset-0 w-full h-full pointer-events-none"
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Preload all />
          
          {/* Hero Section View - Computer Model with independent camera */}
          <CanvasErrorBoundary sectionType="hero">
            <View track={heroViewRef} className="top-0 left-0 w-full h-screen" frames={1}>
              <group position={[0, 0, 0]}>
                <Computers isMobile={isMobile} />
              </group>
              <OrbitControls
                enableZoom={false}
                maxPolarAngle={Math.PI / 2}
                minPolarAngle={Math.PI / 2}
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.5}
              />
            </View>
          </CanvasErrorBoundary>
          
          {/* About Section View - Earth Model with independent camera */}
          <CanvasErrorBoundary sectionType="earth">
            <View track={aboutViewRef} className="top-0 left-0 w-full h-screen" frames={1}>
              <group position={[0, 0, 0]}>
                <Earth />
              </group>
              <OrbitControls
                autoRotate
                enableZoom={false}
                maxPolarAngle={Math.PI / 2}
                minPolarAngle={Math.PI / 2}
                enablePan={false}
                autoRotateSpeed={1}
              />
            </View>
          </CanvasErrorBoundary>
          
          {/* Background Stars - Shared across all views */}
          <CanvasErrorBoundary sectionType="stars">
            <StarsCanvas />
          </CanvasErrorBoundary>
        </Suspense>
      </Canvas>

      {/* HTML Content Layer */}
      <div className="bg-hero-pattern bg-cover bg-no-repeat bg-center relative z-10">
        <Navbar />
        {/* Pass ref to Hero section for view tracking */}
        <div ref={heroViewRef}>
          <Hero />
        </div>
      </div>
      
      {/* Pass ref to About section for view tracking */}
      <div ref={aboutViewRef}>
        <ErrorBoundary sectionName="about">
          <About />
        </ErrorBoundary>
      </div>
      
      <ErrorBoundary sectionName="experience">
        <Experience />
      </ErrorBoundary>
      
      <ErrorBoundary sectionName="tech">
        <Tech />
      </ErrorBoundary>
      
      <ErrorBoundary sectionName="works">
        <Works />
      </ErrorBoundary>
      
      <div className="relative z-10">
        <ErrorBoundary sectionName="contact">
          <Contact />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default App;
