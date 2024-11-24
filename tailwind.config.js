/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx}"],
  mode: "jit",
  theme: {
    extend: {
      colors: {
        primary: "#050816",
        secondary: "#aaa6c3",
        tertiary: "#151030",
        "black-100": "#100d25",
        "black-200": "#090325",
        "white-100": "#f3f3f3",
      },
      keyframes: {
        spin: {
          '33%': { transform: 'rotateX(-36deg) rotateY(-405deg)' },
          '100%': { transform: 'rotateX(-36deg) rotateY(-405deg)' },
        },
        shiftTop: {
          '33%, 100%': { transform: 'rotateX(90deg) translateZ(50px)' },
          '50%, 60%': { transform: 'rotateX(90deg) translateZ(100px)' },
        },
        shiftBottom: {
          '33%, 100%': { transform: 'rotateX(-90deg) translateZ(50px)' },
          '50%, 60%': { transform: 'rotateX(-90deg) translateZ(100px)' },
        },
        shiftRight: {
          '33%, 100%': { transform: 'rotateY(90deg) translateZ(50px)' },
          '50%, 60%': { transform: 'rotateY(90deg) translateZ(100px)' },
        },
        shiftLeft: {
          '33%, 100%': { transform: 'rotateY(-90deg) translateZ(50px)' },
          '50%, 60%': { transform: 'rotateY(-90deg) translateZ(100px)' },
        },
        shiftFront: {
          '33%, 100%': { transform: 'translateZ(50px)' },
          '50%, 60%': { transform: 'translateZ(100px)' },
        },
        shiftBack: {
          '33%, 100%': { transform: 'rotateY(-180deg) translateZ(50px)' },
          '50%, 60%': { transform: 'rotateY(-180deg) translateZ(100px)' },
        },
      },
      animation: {
        spin: 'spin 3s infinite cubic-bezier(0.16, 0.61, 0.49, 0.91)',
        shiftTop: 'shiftTop 3s infinite ease-out',
        shiftBottom: 'shiftBottom 3s infinite ease-out',
        shiftRight: 'shiftRight 3s infinite ease-out',
        shiftLeft: 'shiftLeft 3s infinite ease-out',
        shiftFront: 'shiftFront 3s infinite ease-out',
        shiftBack: 'shiftBack 3s infinite ease-out',
      },
      boxShadow: {
        card: "0px 35px 120px -15px #211e35",
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