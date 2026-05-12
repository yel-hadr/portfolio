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
        
        <ErrorBoundary>
          <About />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <Experience />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <Tech />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <Works />
        </ErrorBoundary>
        
        <div className="relative z-0">
          <StarsCanvas />
          <ErrorBoundary>
            <Contact />
          </ErrorBoundary>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
