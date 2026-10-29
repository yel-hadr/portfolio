import plugin from 'tailwindcss/plugin';

// A color backed by a `--c-<name>` CSS variable holding "R G B" channels, so Tailwind's opacity
// modifiers (bg-background/80) keep working.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  // build/ holds the HTML templates of the generated blog pages
  content: ['./src/**/*.{js,jsx}', './build/**/*.js', './status/**/*.html'],
  theme: {
    extend: {
      // Design tokens. Values live in CSS variables (src/index.css): `:root` is the dark theme,
      // `:root[data-theme='light']` the light one, so every class follows the theme. Every
      // text/background pair meets WCAG AA in both themes (checked by script):
      //   dark:  foreground 17.8:1, muted 8.5:1, primary-400 7.3:1 on background; dark text on
      //          primary 6.8:1; line-strong >= 4:1 on surfaces.
      //   light: foreground 16.0:1, muted 7.1:1, primary-400 5.7:1, secondary 5.9:1 on the warm
      //          background (>= 4.5 on every surface, glass and the footer band); dark text on
      //          primary 4.9:1 (hover 4.5:1); primary focus ring >= 3.0:1; line-strong >= 3.2:1.
      colors: {
        background: token('background'), // page
        surface: {
          DEFAULT: token('surface'), // opaque panels
          raised: token('surface-raised'), // inputs, chips, hover
        },
        foreground: {
          DEFAULT: token('foreground'), // headings and body ("text")
          muted: token('foreground-muted'), // secondary copy
        },
        primary: {
          DEFAULT: token('primary'), // brand orange: button fill, focus ring
          400: token('primary-400'), // orange text on the page background
          hover: token('primary-hover'), // button fill on hover
        },
        'on-primary': token('on-primary'), // text on primary fills (dark in both themes)
        secondary: { DEFAULT: token('secondary') }, // violet on dark, indigo on light: accents
        tertiary: { DEFAULT: token('tertiary') }, // blue: far end of the waves; decorative
        success: token('success'), // form sent, operational status
        danger: token('danger'), // form errors, failed status
        info: token('info'), // tags
        focus: token('focus'), // keyboard focus rings (outline and ring utilities)
        night: token('night'), // the dark background in both themes: FdF's file colors
        ground: token('ground'), // the footer's band: a shade darker than the page in light
        // Translucent fills over the waves (used with backdrop-blur, .card-glass) and hairlines
        // carry their own alpha, so they take no opacity modifier.
        glass: {
          DEFAULT: 'var(--color-glass)',
          strong: 'var(--color-glass-strong)',
        },
        line: {
          DEFAULT: 'var(--color-line)', // decorative hairlines
          strong: token('line-strong'), // control boundaries (non-text contrast >= 3:1)
        },
      },
      // Depth from tokens: none on dark cards (hairlines do it), soft warm layers in light
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        modal: 'var(--shadow-modal)',
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '450px',
      },
      // Game Mode (src/components/Cub3D): used behind motion-safe, so reduced motion drops them
      keyframes: {
        'game-in': { from: { opacity: '0', transform: 'scale(1.04)' } },
        'game-out': { to: { opacity: '0', transform: 'scale(1.04)' } },
        // A CRT switching on: a bright line, then the picture opens vertically
        'crt-in': {
          '0%': { opacity: '0.5', transform: 'scale(0.4, 0.01)' },
          '45%': { opacity: '1', transform: 'scale(1, 0.01)' },
        },
        // Opacity only: the Press E prompt is centered with a transform
        'prompt-in': { from: { opacity: '0' } },
      },
      animation: {
        'game-in': 'game-in 300ms ease-out',
        'game-out': 'game-out 250ms ease-in forwards',
        'crt-in': 'crt-in 280ms ease-out',
        'prompt-in': 'prompt-in 180ms ease-out',
      },
    },
  },
  plugins: [
    // light: for the few element-level differences tokens cannot carry (prefer tokens)
    // (never inside a .scheme-dark island, which stays dark)
    plugin(({ addVariant }) =>
      addVariant('light', ":root[data-theme='light'] &:not(.scheme-dark, .scheme-dark *)")
    ),
  ],
};
