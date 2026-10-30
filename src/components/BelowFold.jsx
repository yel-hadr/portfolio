import { useEffect } from 'react';

import About from './About';
import Blog from './Blog';
import Contact from './Contact';
import Education from './Education';
import ErrorBoundary from './ErrorBoundary';
import Experience from './Experience';
import Tech from './Tech';
import Works from './Works';

/**
 * The sections below the hero, one lazy chunk (App): the first paint waits only on the navbar and
 * the hero, and this chunk starts loading with that first render. A link to one of these sections
 * (#contact) arrived before it existed, so it is followed again once they are in the page
 * @param onReady  called once the sections are in the page (App's 3D layer watches #tech)
 */
const BelowFold = ({ onReady }) => {
  useEffect(() => {
    // A malformed escape in the hash (#%E0) must not throw here: that would unmount the page
    let id = window.location.hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // keep it raw
    }
    if (id && id !== 'main' && id !== 'top') document.getElementById(id)?.scrollIntoView();
    onReady?.();
    // Once, when the sections mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
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
    </>
  );
};

export default BelowFold;
