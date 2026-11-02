import { useI18n } from '../i18n/context';
import { useTheme } from '../theme/context';
import { MoonIcon, SunIcon } from '../components/icons';

// The status page's own copies of the navbar controls (the navbar's are internal to it). Same
// look and the same core.json labels, so both pages behave alike.
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
  const label = theme === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark');
  return (
    <button
      type='button'
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className='inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground'
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};

const Header = () => {
  const { t } = useI18n();
  return (
    <header className='border-b border-line bg-background/80 backdrop-blur-md'>
      <div className='mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8'>
        {/* The site's mark beside the name, as on the portfolio and the blog */}
        <a
          href={import.meta.env.BASE_URL}
          aria-label={t('statuspage.home')}
          className='flex min-w-0 items-center gap-2 rounded-md font-bold text-foreground transition-colors hover:text-primary-400'
        >
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=''
            width={36}
            height={36}
            className='h-9 w-9 shrink-0 object-contain'
          />
          <span className='truncate'>{t('statuspage.brand')}</span>
        </a>
        <div className='flex shrink-0 items-center gap-2'>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;
