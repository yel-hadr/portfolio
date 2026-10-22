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
      //   light: foreground 16.9:1, muted 7.6:1, primary-400 5.7:1 on background; dark text on
      //          primary 5.0:1; primary focus ring 3.4:1; line-strong >= 3.3:1 on surfaces.
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
        secondary: { DEFAULT: token('secondary') }, // violet: waves mid-stop, accents
        tertiary: { DEFAULT: token('tertiary') }, // blue: far end of the waves; decorative
        success: token('success'), // form sent, operational status
        danger: token('danger'), // form errors, failed status
        info: token('info'), // tags
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
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '450px',
      },
    },
  },
  plugins: [],
};
