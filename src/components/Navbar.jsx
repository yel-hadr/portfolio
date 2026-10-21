import { useEffect, useRef, useState } from 'react';

import { styles } from '../styles';
import { navLinks } from '../constans';
import { logo, menu, close } from '../assets';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

const linkClass = (isActive) =>
  `${isActive ? 'text-foreground underline decoration-primary decoration-2 underline-offset-8' : 'text-foreground-muted'} ` +
  'font-medium hover:text-foreground transition-colors';

const Navbar = () => {
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const lastJumpAt = useRef(0);
  const reduced = usePrefersReducedMotion();

  // Sync the active link with the URL hash (back/forward). On first load, sections mount after
  // the browser tried to scroll to the hash, so scroll a deep link (/#experience) ourselves.
  useEffect(() => {
    const syncFromHash = () => setActive(window.location.hash.slice(1));
    syncFromHash();
    const initial = window.location.hash.slice(1);
    if (initial) requestAnimationFrame(() => document.getElementById(initial)?.scrollIntoView());
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Back at the top of the page, no section is current any more. Ignore the first moments
  // of a nav jump: a smooth scroll that starts at the top fires scroll events below 200px.
  useEffect(() => {
    if (!active) return undefined;
    const onScroll = () => {
      if (window.scrollY < 200 && performance.now() - lastJumpAt.current > 1500) setActive('');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [active]);

  // Escape closes the mobile menu and returns focus to its button
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const goTo = (e, id) => {
    const target = document.getElementById(id);
    if (!target) return; // let the browser handle the hash
    e.preventDefault();
    lastJumpAt.current = performance.now();
    setActive(id);
    setOpen(false);
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    // Move focus to the section so keyboard and screen reader users land there too
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    window.history.pushState(null, '', `#${id}`);
  };

  const renderLinks = (className) => (
    <ul className={className}>
      {navLinks.map((link) => (
        <li key={link.id}>
          <a
            href={`#${link.id}`}
            aria-current={active === link.id ? 'location' : undefined}
            className={linkClass(active === link.id)}
            onClick={(e) => goTo(e, link.id)}
          >
            {link.title}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <nav
      aria-label='Main'
      className='w-full fixed top-0 z-50 border-b border-line bg-background/80 backdrop-blur-md'
    >
      <div className={`${styles.container} flex justify-between items-center py-4`}>
        <a
          href='#top'
          className='flex items-center gap-2'
          onClick={() => {
            setActive('');
            setOpen(false);
          }}
        >
          <img src={logo} alt='' className='h-9 w-9 object-contain' />
          <span className='text-foreground text-lg font-bold'>Youssef El Hadraoui</span>
        </a>

        {renderLinks('list-none hidden md:flex flex-row gap-8')}

        <div
          className='md:hidden flex flex-1 justify-end items-center'
          onBlur={(e) => {
            // Close the menu when keyboard focus moves outside it
            if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
          }}
        >
          <button
            ref={toggleRef}
            type='button'
            aria-expanded={open}
            aria-controls='mobile-menu'
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
            className='-m-2 rounded-xl p-2'
          >
            <img src={open ? close : menu} alt='' className='h-7 w-7 object-contain' />
          </button>
          <div
            id='mobile-menu'
            className={`${open ? 'flex' : 'hidden'} p-6 bg-surface/95 backdrop-blur-md border border-line absolute top-16 right-0 mx-4 my-2 min-w-[10rem] z-50 rounded-xl`}
          >
            {renderLinks('list-none flex flex-col gap-4 justify-end items-start')}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
