import { styles } from '../styles';
import { navLinks, person } from '../constans';
import { useI18n } from '../i18n/context';
import SystemStatus from './SystemStatus';

const LINK = 'font-medium text-foreground-muted hover:text-foreground transition-colors';

const Footer = ({ onOpenGames, onEnterGame }) => {
  const { t } = useI18n();
  // The Blog section is reachable from the footer and the terminal, not the main nav
  const links = [...navLinks, { id: 'blog' }];

  return (
    <footer className='relative border-t border-line bg-background/80 backdrop-blur-md'>
      <div
        className={`${styles.container} grid gap-10 py-12 md:grid-cols-[1fr_auto_auto] md:gap-16`}
      >
        <div className='flex flex-col gap-6'>
          <div>
            <p className='text-lg font-bold text-foreground'>{person.name}</p>
            <p className='mt-1 text-sm text-foreground-muted'>{t('person.title')}</p>
          </div>
          <SystemStatus />
        </div>

        <nav aria-label={t('footer.nav')}>
          <ul className='grid grid-cols-2 gap-x-8 gap-y-3 text-sm'>
            {links.map((link) => (
              <li key={link.id}>
                <a href={`#${link.id}`} className={LINK}>
                  {t(`nav.${link.id}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <ul className='flex flex-col gap-3 text-sm'>
          <li>
            <a href={person.github} target='_blank' rel='noopener noreferrer' className={LINK}>
              {t('footer.github')}
              <span className='sr-only'>{t('footer.newTab')}</span>
            </a>
          </li>
          <li>
            <button type='button' onClick={onOpenGames} className={LINK}>
              {t('footer.games')}
            </button>
          </li>
          <li>
            <button type='button' aria-haspopup='dialog' onClick={onEnterGame} className={LINK}>
              {t('gameMode')}
            </button>
          </li>
          <li>
            <a href='#top' className={LINK}>
              {t('footer.backToTop')}
            </a>
          </li>
        </ul>
      </div>
      <div className='border-t border-line'>
        <p className={`${styles.container} py-6 text-sm text-foreground-muted`}>
          {t('footer.rights', { year: new Date().getFullYear(), name: person.name })}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
