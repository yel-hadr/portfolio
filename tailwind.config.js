/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Design tokens. Every text/background pair below meets WCAG AA (checked):
      // foreground 17.8:1, foreground-muted 8.5:1 and primary 6.8:1 on background;
      // muted 7.5:1 on surface-raised; line-strong >= 3.4:1 against both surfaces.
      colors: {
        background: "#050816", // page, night sky
        surface: {
          DEFAULT: "#0e0b22", // cards and panels
          raised: "#171338", // inputs, chips, hover
        },
        foreground: {
          DEFAULT: "#f2f1f7", // headings and body
          muted: "#aaa6c3", // secondary copy
        },
        primary: {
          DEFAULT: "#FF6500", // brand orange; pair with dark text (white on orange is 2.95:1)
          400: "#ff8533",
          600: "#e65b00",
        },
        secondary: {
          DEFAULT: "#a78bfa", // violet from the hero pattern and stars, used sparingly
        },
        line: {
          DEFAULT: "rgb(255 255 255 / 0.1)", // decorative hairlines
          strong: "#77749a", // control boundaries (non-text contrast >= 3:1)
        },
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      screens: {
        xs: "450px",
      },
      backgroundImage: {
        "hero-pattern": "url('/src/assets/herobg.png')",
      },
    },
  },
  plugins: [],
};
