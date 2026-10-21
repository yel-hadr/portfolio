import { styles } from '../styles';

const Footer = () => (
  <footer className='relative border-t border-line'>
    <div
      className={`${styles.container} flex flex-col gap-4 py-10 text-sm text-foreground-muted sm:flex-row sm:items-center sm:justify-between`}
    >
      <p>© {new Date().getFullYear()} Youssef El Hadraoui</p>
      <ul className='flex gap-6'>
        <li>
          <a
            href='https://github.com/yel-hadr'
            target='_blank'
            rel='noopener noreferrer'
            className='font-medium hover:text-foreground transition-colors'
          >
            GitHub<span className='sr-only'> (opens in a new tab)</span>
          </a>
        </li>
        <li>
          <a href='#top' className='font-medium hover:text-foreground transition-colors'>
            Back to top
          </a>
        </li>
      </ul>
    </div>
  </footer>
);

export default Footer;
