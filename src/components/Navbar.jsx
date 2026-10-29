import { useEffect, useRef, useState } from 'react';

import { styles } from '../styles';
import { navLinks } from '../constans';
import { logo } from '../assets';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useI18n } from '../i18n/context';
import { useTheme } from '../theme/context';
import { CloseIcon, MenuIcon, MoonIcon, SunIcon, TerminalIcon } from './icons';

const ICON_BUTTON =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground';

// EN | FR segmented control. The accessible name ("English") contains the visible text ("EN").
const LanguageToggle = () => {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role='group'
      aria-label={t('nav.language')}
      className='flex rounded-xl border border-line-strong p-0.5 text-sm font-semibold'
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
          className={`rounded-[0.6rem] px-2.5 py-1.5 transition-colors ${
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
      className={ICON_BUTTON}
    >
      {toLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};

const linkClass = (isActive) =>
  `${isActive ? 'text-foreground underline decoration-primary decoration-2 underline-offset-8' : 'text-foreground-muted'} ` +
  'font-medium hover:text-foreground transition-colors';

/**
 * @param {() => void} onOpenTerminal - opens the terminal overlay (App owns its state)
 */
const Navbar = ({ onOpenTerminal }) => {
  const { t } = useI18n();
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const lastY = useRef(0);
  const reduced = usePrefersReducedMotion();

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
            {t(`nav.${link.id}`)}
          </a>
        </li>
      ))}
    </ul>
  );

  const terminalButton = (extra = '') => (
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
      className={`${ICON_BUTTON} ${extra}`}
    >
      <TerminalIcon />
    </button>
  );

  return (
    <nav
      aria-label={t('nav.main')}
      // Frosted glass over the page; in light a soft shadow under it as well as the hairline
      className='w-full fixed top-0 z-50 border-b border-line bg-background/80 shadow-card backdrop-blur-md light:bg-background/90'
    >
      <div className={`${styles.container} flex items-center justify-between gap-4 py-3.5`}>
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

        <div className='flex items-center gap-6 xl:gap-8'>
          {renderLinks('list-none hidden lg:flex flex-row gap-6 xl:gap-8')}

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
                className={ICON_BUTTON}
              >
                {open ? <CloseIcon className='h-6 w-6' /> : <MenuIcon className='h-6 w-6' />}
              </button>
              <div
                id='mobile-menu'
                className={`${open ? 'flex' : 'hidden'} absolute right-0 top-14 z-50 min-w-[12rem] flex-col gap-5 rounded-xl border border-line bg-surface/95 p-6 backdrop-blur-md light:shadow-raised`}
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
