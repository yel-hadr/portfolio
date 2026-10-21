import { styles } from '../styles';
import { navLinks, person } from '../constans';

const LINK = 'font-medium text-foreground-muted hover:text-foreground transition-colors';

const Footer = () => (
  <footer className='relative border-t border-line bg-background/80 backdrop-blur-md'>
    <div className={`${styles.container} grid gap-10 py-12 md:grid-cols-[1fr_auto_auto] md:gap-16`}>
      <div>
        <p className='text-lg font-bold text-foreground'>{person.name}</p>
        <p className='mt-1 text-sm text-foreground-muted'>{person.title}</p>
      </div>

      <nav aria-label='Footer'>
        <ul className='grid grid-cols-2 gap-x-8 gap-y-3 text-sm'>
          {navLinks.map((link) => (
            <li key={link.id}>
              <a href={`#${link.id}`} className={LINK}>
                {link.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <ul className='flex flex-col gap-3 text-sm'>
        <li>
          <a href={person.github} target='_blank' rel='noopener noreferrer' className={LINK}>
            GitHub<span className='sr-only'> (opens in a new tab)</span>
          </a>
        </li>
        <li>
          <a href='#top' className={LINK}>
            Back to top
          </a>
        </li>
      </ul>
    </div>
    <div className='border-t border-line'>
      <p className={`${styles.container} py-6 text-sm text-foreground-muted`}>
        © {new Date().getFullYear()} {person.name}
      </p>
    </div>
  </footer>
);

export default Footer;
