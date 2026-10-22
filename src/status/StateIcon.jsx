// Status glyphs, so a state never relies on color alone: a check, a warning sign, a cross, or a
// dash for "no data". Decorative: the text next to them carries the meaning.
const PATHS = {
  good: <path d='M8 12.5l2.5 2.5L16 9.5' />,
  warn: <path d='M12 8v5M12 16.5v.01' />,
  bad: <path d='M9 9l6 6M15 9l-6 6' />,
  neutral: <path d='M8.5 12h7' />,
};

const StateIcon = ({ tone, className = 'h-5 w-5' }) => (
  <svg
    aria-hidden='true'
    focusable='false'
    viewBox='0 0 24 24'
    className={`shrink-0 ${className}`}
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    {tone === 'warn' ? (
      <path d='M10.3 4.2L2.8 17.5A2 2 0 004.5 20.5h15a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z' />
    ) : (
      <circle cx='12' cy='12' r='9' />
    )}
    {PATHS[tone] ?? PATHS.neutral}
  </svg>
);

export default StateIcon;
