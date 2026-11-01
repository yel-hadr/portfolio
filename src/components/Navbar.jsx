import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { m } from 'framer-motion';

import { navLinks } from '../constans';
import { logo } from '../assets';
import { useModalDialog } from '../hooks/useModalDialog';
import { setMotionPaused, useMotionPaused } from '../hooks/useMotionPaused';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useI18n } from '../i18n/context';
import { useTheme } from '../theme/context';
import { SPRING } from '../utils/motion';
import { CloseIcon, MenuIcon, MoonIcon, PauseIcon, PlayIcon, SunIcon, TerminalIcon } from './icons';

// No display of its own: each button sets it (`hidden lg:inline-flex` must not meet an inline-flex).
// Hover lightens the fill and lifts the button a touch (scale 1.05), eased over 200 ms
const ICON_BUTTON =
  'relative h-10 w-10 items-center justify-center rounded-full text-foreground-muted transition-[color,background-color,box-shadow,transform] duration-200 ease-out hover:bg-surface-raised hover:text-foreground motion-safe:hover:scale-105';

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

// The sun turns into the moon and back: both icons stacked, the current one upright, the other
// rotated away and shrunk (.icon-swap in index.css, a spring-like overshoot; instant under reduced
// motion)
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
      <span aria-hidden='true' className='icon-swap' data-state={toLight ? 'on' : 'off-ccw'}>
        <SunIcon />
      </span>
      <span aria-hidden='true' className='icon-swap' data-state={toLight ? 'off-cw' : 'on'}>
        <MoonIcon />
      </span>
    </button>
  );
};

// Pauses the page's ambient animations (WCAG 2.2.2; useMotionPaused). A toggle button: its name
// stays the same and aria-pressed carries the state. Pressed, it turns orange inside an orange ring
// with a faint glow (dark only), so the state is more than a color; the icons morph as the theme's do
const MotionToggle = () => {
  const paused = useMotionPaused();
  const { t } = useI18n();
  return (
    <button
      type='button'
      aria-pressed={paused}
      onClick={() => setMotionPaused(!paused)}
      aria-label={t('nav.pauseMotion')}
      // The same text as the name: a title that changed with the state would be read as a
      // description contradicting it
      title={t('nav.pauseMotion')}
      className={`inline-flex ${ICON_BUTTON} ${paused ? 'bg-primary/15 text-primary-400 ring-1 ring-primary-400 shadow-[0_0_14px_rgb(var(--c-primary)/calc(0.35*var(--glow)))] hover:bg-primary/20 hover:text-primary-400' : ''}`}
    >
      <span aria-hidden='true' className='icon-swap' data-state={paused ? 'off-ccw' : 'on'}>
        <PauseIcon className='h-4 w-4' />
      </span>
      <span aria-hidden='true' className='icon-swap' data-state={paused ? 'on' : 'off-cw'}>
        <PlayIcon className='h-4 w-4' />
      </span>
    </button>
  );
};

// The current link is marked by more than its color: in the desktop track it stands on the sliding
// pill, which has a ring (>= 3:1 on the track; forced colors drop it, so an underline there); in the
// mobile sheet its row is filled and carries an orange bar on its left edge
const ON_PILL = 'forced-colors:underline forced-colors:underline-offset-4';
const linkClass = (isActive) =>
  `${isActive ? `text-foreground ${ON_PILL}` : 'text-foreground-muted'} ` +
  'font-medium hover:text-foreground transition-colors';

/**
 * Where the pill behind the current link should sit, measured from the link itself, and again
 * whenever the row resizes (a language switch, the web font arriving, the window).
 * @returns {{ x: number, width: number, shown: boolean } | null} null until a link has been current;
 *   shown is false while the current section has no link
 */
const usePillPosition = (listRef, active) => {
  const [pill, setPill] = useState(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !active) return undefined;
    const measure = () => {
      const link = list.querySelector(`a[href="#${active}"]`);
      // A section with no nav link (the blog, the tech stack, the top): the pill fades out where
      // it is, rather than staying lit under the last link while none is aria-current
      if (link) setPill({ x: link.offsetLeft, width: link.offsetWidth, shown: true });
      else setPill((prev) => (prev ? { ...prev, shown: false } : prev));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, active]);
  return pill;
};

/**
 * The page's scroll as the navbar needs it: `scrolled` past the first 10px (its edge fades in),
 * and `down`, scrolling down past the hero's first 120px (it slides away; any scroll up brings it
 * back). Read at most once a frame from a passive listener; a re-render only when one flips. Small
 * moves add up until they pass 4px, so a slow scroll counts as much as a fast one. `holdRef`: until
 * that time (a jump from the bar's own links, which scrolls down by itself), it stays in view
 */
const useNavScroll = (holdRef) => {
  const [state, setState] = useState({ scrolled: false, down: false });
  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const read = () => {
      raf = 0;
      const y = window.scrollY;
      const delta = y - last;
      const moved = Math.abs(delta) > 4;
      setState((prev) => {
        const scrolled = y > 10;
        let down = prev.down;
        if (y < 120 || performance.now() < holdRef.current) down = false;
        else if (moved) down = delta > 0;
        return scrolled === prev.scrolled && down === prev.down ? prev : { scrolled, down };
      });
      if (moved || y < 120) last = y;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [holdRef]);
  return state;
};

// The sheet's spring: quick, a hint of overshoot, settled in about 0.4 s
const SHEET_SPRING = { type: 'spring', stiffness: 380, damping: 34 };

/**
 * The mobile menu: a bottom sheet of frosted glass that springs up over a dimmed, blurred page.
 * useModalDialog makes the page inert, keeps Tab inside, closes on Escape or a backdrop tap. On
 * closing it slides back down first; `closing` drives that, and `onClosed` runs at the end.
 */
const MobileSheet = ({ id, closing, onClose, onClosed, renderLinks, onTerminal }) => {
  const { t } = useI18n();
  const titleId = useId();
  const { overlayRef, panelRef, close, release, onKeyDown, backdrop } = useModalDialog(onClose);

  useEffect(() => {
    panelRef.current?.focus();
  }, [panelRef]);

  // Widened to the desktop layout while open (a rotated tablet): the sheet hides there (lg), so
  // close it, or the page would stay inert behind nothing
  const closeOnWide = useEffectEvent(() => close());
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (wide.matches) closeOnWide();
    };
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[60] flex items-end bg-background/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${closing ? 'opacity-0' : 'motion-safe:animate-backdrop-in'}`}
      {...backdrop}
    >
      <m.div
        ref={panelRef}
        id={id}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        initial={{ y: '100%' }}
        animate={{ y: closing ? '100%' : '0%' }}
        transition={SHEET_SPRING}
        onAnimationComplete={() => {
          if (closing) onClosed();
        }}
        // Never taller than the screen (a phone held sideways): it scrolls inside, Close in view
        className='max-h-[100dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-b-0 border-line bg-glass-strong px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-modal outline-hidden backdrop-blur-xl'
      >
        {/* A grab handle, as on a native sheet (decorative: the close button and Escape close it) */}
        <div aria-hidden='true' className='mx-auto h-1.5 w-10 rounded-full bg-line-strong' />
        <div className='mt-3 flex items-center justify-between px-2'>
          <h2 id={titleId} className='text-sm font-semibold uppercase tracking-[0.14em] text-metal'>
            {t('nav.menu')}
          </h2>
          <button
            type='button'
            onClick={close}
            aria-label={t('nav.closeMenu')}
            className={`inline-flex ${ICON_BUTTON}`}
          >
            <CloseIcon className='h-6 w-6' />
          </button>
        </div>
        {/* Large rows (52px), the current one filled with an orange bar on its edge */}
        {renderLinks(release)}
        <div className='mt-2 border-t border-line pt-2'>
          <button
            type='button'
            onClick={() => {
              release();
              onTerminal();
            }}
            aria-haspopup='dialog'
            className='flex min-h-13 w-full items-center gap-3 short:min-h-11 rounded-2xl px-4 text-lg font-medium text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground'
          >
            <TerminalIcon />
            {t('nav.openTerminal')}
          </button>
        </div>
      </m.div>
    </div>,
    document.body
  );
};

/**
 * @param {() => void} onOpenTerminal - opens the terminal overlay (App owns its state)
 */
const Navbar = ({ onOpenTerminal }) => {
  const { t } = useI18n();
  const [active, setActive] = useState('');
  // The mobile sheet: 'closed', 'open', or 'closing' (sliding back down)
  const [sheet, setSheet] = useState('closed');
  const [focusInside, setFocusInside] = useState(false);
  const toggleRef = useRef(null);
  const linksRef = useRef(null);
  // Where focus goes once the sheet has closed: back to its button, unless a link moved it on
  const returnFocus = useRef(true);
  const reduced = usePrefersReducedMotion();
  const pill = usePillPosition(linksRef, active);
  // Until when a jump from the bar keeps the bar in view (the smooth scroll it starts goes down)
  const holdUntil = useRef(0);
  const { scrolled, down } = useNavScroll(holdUntil);
  // Slides away while reading down; never under reduced motion, with keyboard focus in the bar
  // (it must stay in view) or with the sheet up
  const hidden = down && !reduced && !focusInside && sheet === 'closed';

  // Sync the active link with the URL hash (back/forward, and the page's own #links: the hero's,
  // the footer's), held like a jump from the bar so the scroll spy does not flick through the
  // sections on the way. On first load, sections mount after the browser tried to scroll to the
  // hash, so scroll a deep link (/#experience) ourselves.
  useEffect(() => {
    const syncFromHash = () => {
      holdUntil.current = performance.now() + 1500;
      setActive(window.location.hash.slice(1));
    };
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

  // The link follows the reading: the section crossing a line 40% down the viewport is current (the
  // hero, back at the top, clears it; a section with no link, such as the tech stack or the blog, hides the pill).
  // Not while a jump from the bar scrolls (holdUntil): the clicked link stays current on the way.
  // The sections below the hero mount later (a lazy chunk), so new ones are observed as they come
  useEffect(() => {
    const main = document.getElementById('main');
    if (!main || typeof IntersectionObserver === 'undefined') return undefined;
    // The last section to cross the line, applied at once, or when a jump's hold ends (a reader
    // who scrolls on during the hold is caught up with, not left on the jump's link)
    let latest = null;
    let timer = 0;
    const apply = () => {
      timer = 0;
      const wait = holdUntil.current - performance.now();
      if (wait > 0) {
        timer = setTimeout(apply, wait + 50);
        return;
      }
      if (latest !== null) setActive(latest === 'hero' ? '' : latest);
    };
    const spy = new IntersectionObserver(
      (entries) => {
        const crossing = entries.filter((entry) => entry.isIntersecting).at(-1);
        if (!crossing) return;
        latest = crossing.target.id;
        if (!timer) apply();
      },
      { rootMargin: '-40% 0px -59% 0px' }
    );
    // The sections are main's own children (BelowFold renders a fragment): only those are watched
    const watch = () =>
      main.querySelectorAll(':scope > section[id]').forEach((s) => spy.observe(s));
    watch();
    const added = new MutationObserver(watch);
    added.observe(main, { childList: true });
    return () => {
      clearTimeout(timer);
      added.disconnect();
      spy.disconnect();
    };
  }, []);

  // Closing the sheet: it slides down first (instant under reduced motion), then unmounts
  const finishClose = () => {
    setSheet('closed');
    if (returnFocus.current) requestAnimationFrame(() => toggleRef.current?.focus());
  };
  const closeSheet = () => {
    if (reduced) finishClose();
    else setSheet('closing');
  };

  const goTo = (e, id) => {
    const target = document.getElementById(id);
    if (!target) return; // let the browser handle the hash
    e.preventDefault();
    setActive(id);
    // The jump scrolls down by itself: the bar stays, to take the next click
    holdUntil.current = performance.now() + 1500;
    if (sheet !== 'closed') {
      // The link moves focus to its section: the sheet must not hand it back to its button
      returnFocus.current = false;
      closeSheet();
    }
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    // Move focus to the section so keyboard and screen reader users land there too
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    window.history.pushState(null, '', `#${id}`);
  };

  // The desktop track: links on a recessed rail, the current one on the sliding pill
  const desktopLinks = (
    <ul
      ref={linksRef}
      className='relative list-none hidden lg:flex items-center rounded-full bg-surface/80 p-1 shadow-track'
    >
      {pill && (
        // The pill behind the current link: it springs from link to link (motion values on x
        // and width, measured from the link: the look of a layoutId indicator without framer's
        // layout bundle on the first paint), and fades out when no section is current. Instant
        // under reduced motion
        <m.li
          aria-hidden='true'
          className='pointer-events-none absolute inset-y-1 left-0 rounded-full bg-surface-raised ring-1 ring-line-strong'
          initial={false}
          animate={{ x: pill.x, width: pill.width, opacity: active && pill.shown ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : SPRING}
        />
      )}
      {navLinks.map((link) => (
        <li key={link.id}>
          <a
            href={`#${link.id}`}
            aria-current={active === link.id ? 'location' : undefined}
            className={`${linkClass(active === link.id)} relative z-10 block rounded-full px-3.5 py-1.5`}
            onClick={(e) => goTo(e, link.id)}
          >
            {t(`nav.${link.id}`)}
          </a>
        </li>
      ))}
    </ul>
  );

  // The sheet's links: full-width rows, the current one filled and marked by an orange bar.
  // `release` lets the page go first (inert, scroll lock), so the jump can scroll and focus it
  const sheetLinks = (release) => (
    <ul className='mt-2 flex list-none flex-col gap-1'>
      {navLinks.map((link) => {
        const isActive = active === link.id;
        return (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={(e) => {
                release();
                goTo(e, link.id);
              }}
              className={`relative flex min-h-13 items-center rounded-2xl short:min-h-11 px-4 text-lg font-medium transition-colors ${
                isActive
                  ? 'bg-surface-raised text-foreground before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-full before:bg-primary-400 forced-colors:underline'
                  : 'text-foreground-muted hover:bg-surface-raised hover:text-foreground'
              }`}
            >
              {t(`nav.${link.id}`)}
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav
      aria-label={t('nav.main')}
      // A floating pill of frosted glass, clear of the page's edges. Never transformed itself: the
      // pill inside slides, so nothing here becomes a containing block
      className='fixed inset-x-0 top-3 z-50'
      onFocus={() => setFocusInside(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocusInside(false);
      }}
    >
      {/* The page's column (styles.container) less the pill's inner edge (8 px padding and its
          1 px border), so the logo lines up with the content's left edge at every width */}
      <div className='mx-auto max-w-7xl px-[calc(--spacing(6)-9px)] sm:px-[calc(--spacing(10)-9px)] lg:px-[calc(--spacing(16)-9px)]'>
        {/* The pill: blurred glass at 80%, slid away while reading down (transform only, so the
            page never shifts). The transparent border is its edge in forced colors */}
        <div
          className={`relative isolate flex items-center justify-between gap-4 rounded-full border border-transparent bg-background/80 py-1.5 pl-2 pr-2 backdrop-blur-xl transition-transform duration-300 ease-out ${hidden ? '-translate-y-[calc(100%+1rem)]' : ''}`}
        >
          {/* Its edge: nothing at the top of the page, so it melts into the hero; a hairline (and
            the dark top highlight, the light shadow) fading in once the page scrolls */}
          <span
            aria-hidden='true'
            className={`pointer-events-none absolute -inset-px -z-10 rounded-full border border-nav-edge shadow-card light:shadow-raised transition-opacity duration-300 ease-out ${scrolled ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* The page's film grain inside the glass too (the blur wipes out the page's own), so the
            pill reads as frosted glass rather than a flat sheet */}
          <span
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-full'
          >
            <span className='grain absolute inset-0' />
          </span>

          <a
            href='#top'
            aria-label={t('nav.home')}
            className='flex shrink-0 items-center gap-2'
            onClick={() => setActive('')}
          >
            <img src={logo} alt='' className='h-9 w-9 object-contain' />
            {/* Not beside the desktop links until xl: from lg to xl the column leaves them no room */}
            <span
              aria-hidden='true'
              className='hidden text-lg font-bold text-foreground xs:inline lg:hidden xl:inline'
            >
              Youssef El Hadraoui
            </span>
          </a>

          {desktopLinks}

          <div className='flex items-center gap-1.5'>
            <LanguageToggle />
            <ThemeToggle />
            <MotionToggle />
            <button
              type='button'
              onClick={onOpenTerminal}
              aria-haspopup='dialog'
              aria-keyshortcuts='Control+`'
              aria-label={t('nav.openTerminal')}
              title={`${t('nav.openTerminal')} (${t('nav.terminalShortcut')})`}
              className={`hidden lg:inline-flex ${ICON_BUTTON}`}
            >
              <TerminalIcon />
            </button>
            <button
              ref={toggleRef}
              type='button'
              aria-expanded={sheet === 'open'}
              aria-controls='mobile-menu'
              aria-haspopup='dialog'
              aria-label={t('nav.openMenu')}
              onClick={() => {
                returnFocus.current = true;
                setSheet('open');
              }}
              className={`inline-flex lg:hidden ${ICON_BUTTON}`}
            >
              <MenuIcon className='h-6 w-6' />
            </button>
          </div>
        </div>
      </div>

      {sheet !== 'closed' && (
        <MobileSheet
          id='mobile-menu'
          closing={sheet === 'closing'}
          onClose={closeSheet}
          onClosed={finishClose}
          renderLinks={sheetLinks}
          onTerminal={() => {
            // The terminal takes over: the sheet goes at once, focus parked on its button (the
            // element the terminal returns focus to on close)
            setSheet('closed');
            toggleRef.current?.focus();
            onOpenTerminal();
          }}
        />
      )}
    </nav>
  );
};

export default Navbar;
