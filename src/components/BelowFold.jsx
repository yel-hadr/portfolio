import { useEffect, useEffectEvent } from 'react';

import About from './About';
import Blog from './Blog';
import Contact from './Contact';
import Education from './Education';
import ErrorBoundary from './ErrorBoundary';
import Experience from './Experience';
import Tech from './Tech';
import Works from './Works';

// The section the location's hash names, if any. A malformed escape (#%E0) must not throw: that
// would unmount the page; it is kept raw
const hashTarget = () => {
  const raw = window.location.hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/**
 * The sections below the hero, one lazy chunk (App): the first paint waits only on the navbar and
 * the hero, and this chunk starts loading with that first render. A link to one of these sections
 * (#contact) arrived before it existed, so it is followed again once they are in the page
 * @param onReady  called once the sections are in the page (App's 3D layer watches #tech)
 */
const BelowFold = ({ onReady }) => {
  const followHash = useEffectEvent(() => {
    const id = hashTarget();
    const target = id && id !== 'main' && id !== 'top' ? document.getElementById(id) : null;
    if (target) {
      target.scrollIntoView();
      // Focus too, as a nav click does: Tab then continues from the section, not the page's top
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    onReady?.();
  });
  // Once, when the sections mount
  useEffect(() => {
    followHash();
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
