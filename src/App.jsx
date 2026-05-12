import { BrowserRouter } from "react-router-dom";
import { About, Contact, Experience, Hero, Navbar, Tech, Works, StarsCanvas, ErrorBoundary } from "./components";

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="relative z-0 bg-primary">
        <div className="bg-hero-pattern bg-cover bg-no-repeat bg-center">
          <Navbar />
          <Hero />
        </div>
        
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
        
        <div className="relative z-0">
          <StarsCanvas />
          <ErrorBoundary sectionName="contact">
            <Contact />
          </ErrorBoundary>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
