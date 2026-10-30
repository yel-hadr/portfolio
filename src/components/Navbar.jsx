import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';

import { navLinks } from '../constans';
import { logo } from '../assets';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useI18n } from '../i18n/context';
import { useTheme } from '../theme/context';
import { SPRING } from '../utils/motion';
import { CloseIcon, MenuIcon, MoonIcon, SunIcon, TerminalIcon } from './icons';

// No display of its own: each button sets it (`hidden lg:inline-flex` must not meet an inline-flex)
const ICON_BUTTON =
  'h-10 w-10 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground';

// EN | FR segmented control. The accessible name ("English") contains the visible text ("EN").
const LanguageToggle = () => {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role='group'
      aria-label={t('nav.language')}
      className='flex rounded-full border border-line-strong p-0.5 text-sm font-semibold'
    >
      {[
        ['en', 'EN', 'English'],
        ['fr', 'FR', 'Français'],
      ].map(([code, short, full]) => (
        <button
          key={code}
          type='button'
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`rounded-full px-2.5 py-1.5 transition-colors ${
            lang === code
              ? 'bg-primary text-on-primary forced-colors:underline forced-colors:decoration-2 forced-colors:underline-offset-4'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <span aria-hidden='true'>{short}</span>
          <span className='sr-only'>{full}</span>
        </button>
      ))}
    </div>
  );
};

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const toLight = theme === 'dark';
  return (
    <button
      type='button'
      onClick={toggleTheme}
      aria-label={toLight ? t('nav.themeToLight') : t('nav.themeToDark')}
      title={toLight ? t('nav.themeToLight') : t('nav.themeToDark')}
      className={`inline-flex ${ICON_BUTTON}`}
    >
      {toLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};

// The current link is marked by more than its color: in the desktop track it stands on the sliding
// pill, which has a ring (>= 3:1 on the track; forced colors drop it, so an underline there); in the
// mobile menu it is underlined
const ON_PILL = 'forced-colors:underline forced-colors:underline-offset-4';
const UNDERLINED = 'underline decoration-primary-400 decoration-2 underline-offset-8';
const linkClass = (isActive, mark) =>
  `${isActive ? `text-foreground ${mark}` : 'text-foreground-muted'} ` +
  'font-medium hover:text-foreground transition-colors';

/**
 * Where the pill behind the current link should sit, measured from the link itself, and again
 * whenever the row resizes (a language switch, the web font arriving, the window).
 * @returns {{ x: number, width: number } | null} null until a link has been current
 */
const usePillPosition = (listRef, active) => {
  const [pill, setPill] = useState(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !active) return undefined;
    const measure = () => {
      const link = list.querySelector(`a[href="#${active}"]`);
      if (link) setPill({ x: link.offsetLeft, width: link.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, active]);
  return pill;
};

/**
 * @param {() => void} onOpenTerminal - opens the terminal overlay (App owns its state)
 */
const Navbar = ({ onOpenTerminal }) => {
  const { t } = useI18n();
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const linksRef = useRef(null);
  const lastY = useRef(0);
  const reduced = usePrefersReducedMotion();
  const pill = usePillPosition(linksRef, active);

  // Sync the active link with the URL hash (back/forward). On first load, sections mount after
  // the browser tried to scroll to the hash, so scroll a deep link (/#experience) ourselves.
  useEffect(() => {
    const syncFromHash = () => setActive(window.location.hash.slice(1));
    syncFromHash();
    const initial = window.location.hash.slice(1);
    if (initial)
      requestAnimationFrame(() => {
        const target = document.getElementById(initial);
        if (!target) return;
        target.scrollIntoView();
        // Move focus too, so the next Tab and screen readers continue from the section
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Back at the top of the page, no section is current any more. Only clear on an upward
  // scroll: a nav jump from the top scrolls down through the first 200px, however slowly.
  useEffect(() => {
    if (!active) return undefined;
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 200 && y < lastY.current) setActive('');
      lastY.current = y;
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
    setActive(id);
    setOpen(false);
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    // Move focus to the section so keyboard and screen reader users land there too
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    window.history.pushState(null, '', `#${id}`);
  };

  const renderLinks = (className, linkPadding = '', listRef = undefined, indicator = null) => (
    <ul ref={listRef} className={className}>
      {indicator}
      {navLinks.map((link) => (
        <li key={link.id}>
          <a
            href={`#${link.id}`}
            aria-current={active === link.id ? 'location' : undefined}
            className={`${linkClass(active === link.id, indicator ? ON_PILL : UNDERLINED)} ${linkPadding}`}
            onClick={(e) => goTo(e, link.id)}
          >
            {t(`nav.${link.id}`)}
          </a>
        </li>
      ))}
    </ul>
  );

  // The pill behind the current link: it springs from link to link, and fades out when no
  // section is current. Instant under reduced motion
  const indicator = pill && (
    <m.li
      aria-hidden='true'
      className='pointer-events-none absolute inset-y-1 left-0 rounded-full bg-surface-raised ring-1 ring-line-strong'
      initial={false}
      animate={{ x: pill.x, width: pill.width, opacity: active ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : SPRING}
    />
  );

  const terminalButton = (display = 'inline-flex') => (
    <button
      type='button'
      onClick={() => {
        setOpen(false);
        onOpenTerminal();
      }}
      aria-haspopup='dialog'
      aria-keyshortcuts='Control+`'
      aria-label={t('nav.openTerminal')}
      title={`${t('nav.openTerminal')} (${t('nav.terminalShortcut')})`}
      className={`${display} ${ICON_BUTTON}`}
    >
      <TerminalIcon />
    </button>
  );

  return (
    <nav
      aria-label={t('nav.main')}
      // A floating pill of frosted glass, clear of the page's edges, with a hairline ring inside;
      // in light a soft shadow under it as well
      className='fixed inset-x-3 top-3 z-50 sm:inset-x-6'
    >
      {/* The transparent border is the pill's edge in forced colors, which drop the ring */}
      <div className='mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border border-transparent bg-background/80 py-1.5 pl-2 pr-2 shadow-card ring-1 ring-edge-ring backdrop-blur-xl light:bg-background/90 light:shadow-raised'>
        <a
          href='#top'
          aria-label={t('nav.home')}
          className='flex shrink-0 items-center gap-2'
          onClick={() => {
            setActive('');
            setOpen(false);
          }}
        >
          <img src={logo} alt='' className='h-9 w-9 object-contain' />
          <span aria-hidden='true' className='hidden text-lg font-bold text-foreground xs:inline'>
            Youssef El Hadraoui
          </span>
        </a>

        {/* The links in a recessed track, the current one on the sliding pill */}
        {renderLinks(
          'relative list-none hidden lg:flex items-center rounded-full bg-surface/80 p-1 shadow-track',
          'relative z-10 block rounded-full px-3.5 py-1.5',
          linksRef,
          indicator
        )}

        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-1.5'>
            <LanguageToggle />
            <ThemeToggle />
            {terminalButton('hidden lg:inline-flex')}

            <div
              className='relative lg:hidden'
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
                aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
                onClick={() => setOpen((v) => !v)}
                className={`inline-flex ${ICON_BUTTON}`}
              >
                {open ? <CloseIcon className='h-6 w-6' /> : <MenuIcon className='h-6 w-6' />}
              </button>
              <div
                id='mobile-menu'
                className={`${open ? 'flex' : 'hidden'} absolute right-0 top-full z-50 mt-3 min-w-[12rem] flex-col gap-5 rounded-3xl border border-line bg-surface/95 p-6 backdrop-blur-xl light:shadow-raised`}
              >
                {renderLinks('list-none flex flex-col gap-4 items-start')}
                <div className='border-t border-line pt-4'>
                  <button
                    type='button'
                    onClick={() => {
                      setOpen(false);
                      // The menu item disappears with the menu: hand focus to the visible menu
                      // toggle first, so it is the element focus returns to on close
                      toggleRef.current?.focus();
                      onOpenTerminal();
                    }}
                    aria-haspopup='dialog'
                    className='inline-flex items-center gap-2 whitespace-nowrap font-medium text-foreground-muted transition-colors hover:text-foreground'
                  >
                    <TerminalIcon />
                    {t('nav.openTerminal')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
