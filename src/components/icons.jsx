// Inline SVG icons drawn with currentColor, so they follow the theme (the old menu/close/github
// image assets were white-only). All are decorative: the control that holds them is labeled.
const Svg = ({ children, className = 'h-5 w-5', viewBox = '0 0 24 24', ...props }) => (
  <svg aria-hidden='true' focusable='false' viewBox={viewBox} className={className} {...props}>
    {children}
  </svg>
);

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// GitHub mark (Octicons, MIT)
export const GithubIcon = (props) => (
  <Svg viewBox='0 0 16 16' fill='currentColor' {...props}>
    <path d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z' />
  </Svg>
);

export const MenuIcon = (props) => (
  <Svg {...stroke} {...props}>
    <path d='M4 7h16M10 12h10M4 17h16' />
  </Svg>
);

export const CloseIcon = (props) => (
  <Svg {...stroke} {...props}>
    <path d='M6 6l12 12M18 6L6 18' />
  </Svg>
);

export const SunIcon = (props) => (
  <Svg {...stroke} {...props}>
    <circle cx='12' cy='12' r='4' />
    <path d='M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4' />
  </Svg>
);

export const MoonIcon = (props) => (
  <Svg {...stroke} {...props}>
    <path d='M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' />
  </Svg>
);

export const ChevronUpIcon = (props) => (
  <Svg {...stroke} strokeWidth={2} {...props}>
    <path d='M6 15l6-6 6 6' />
  </Svg>
);

export const PauseIcon = (props) => (
  <Svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </Svg>
);

export const PlayIcon = (props) => (
  <Svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    <path d='M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z' />
  </Svg>
);

export const TerminalIcon = (props) => (
  <Svg {...stroke} {...props}>
    <rect x='2.5' y='4' width='19' height='16' rx='2.5' />
    <path d='M7 9.5l3 2.5-3 2.5M12.5 15h4.5' />
  </Svg>
);
