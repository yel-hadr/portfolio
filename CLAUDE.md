# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal 3D portfolio: a Vite 5 single-page app in React 18 with React Three Fiber + drei, Tailwind 3 and framer-motion. Deployed to GitHub Pages at https://yel-hadr.github.io/portfolio/.

## Commands

```bash
npm run dev       # Vite dev server — served under /portfolio/ (see base path below)
npm run build     # production build into dist/
npm run preview   # serve dist/ locally
npm run lint      # eslint . (flat config in eslint.config.js)
npm run deploy    # predeploy runs lint + build, then gh-pages publishes dist/
npx eslint src/components/Hero.jsx   # lint a single file
```

There is no test suite and no Prettier config yet.

## Ground rules

- **JavaScript/JSX only.** Do not introduce TypeScript (no `.ts`/`.tsx`, no type annotations) unless explicitly asked.
- **`src/constans/` is spelled that way on purpose** (legacy spelling). Do not "fix" it in passing. A rename must be its own commit that updates every import.
- **EmailJS keys come only from `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`** (read via `import.meta.env` in `Contact.jsx`, set in a gitignored `.env`). Never hardcode them. `VITE_*` values are inlined into the client bundle by design.
- Never hand-edit `.env*`, `package-lock.json` or `dist/`. A PreToolUse hook in `.claude/settings.json` blocks edits to `.env*` and the lockfile.

## Claude Code tooling in this repo

- Skills (user-only): `/add-project` (add a project, experience or tech entry end to end) and `/deploy` (checks, build, publish to GitHub Pages, live verification).
- Subagents (read-only reporters): `r3f-performance-reviewer` and `a11y-reviewer`.
- Hooks: ESLint runs on every edited `.js`/`.jsx` file, and edits to `.env*` and `package-lock.json` are blocked. Scripts live in `.claude/hooks/`.
- MCP: the `playwright` server (`.mcp.json`) drives Chromium for screenshots and console logs. Use context7 for library docs.

## Base path (GitHub Pages)

`vite.config.js` sets `base: '/portfolio/'`, and `BrowserRouter` gets `basename={import.meta.env.BASE_URL}`. Consequences:
- The dev server URL is `http://localhost:5173/portfolio/`.
- Imported assets and `url()` in CSS are rewritten by Vite automatically.
- Files in `public/` (the gltf models) must be referenced relatively (`./planet/scene.gltf`) or via `import.meta.env.BASE_URL`. A leading `/` will 404 in production.

## Architecture

**Data-driven content.** All portfolio content (`navLinks`, `services`, `technologies`, `experiences`, `projects`) lives in `src/constans/index.js`. Images live in `src/assets/` and are re-exported by name from `src/assets/index.js`, which the constants file imports. Section components just map over these arrays. Adding content means asset → `assets/index.js` export → entry in `constans/index.js`. Components should not need to change. The `/add-project` skill automates this.

**Sections.** `App.jsx` renders Navbar, Hero, About, Experience, Tech, Works and Contact. Most sections are wrapped by the `SectionWrapper(Component, idName)` HOC (`src/hoc/sectionWrapper.jsx`). It adds the `motion.section` stagger-in animation, shared padding, and the `<span class="hash-link" id={idName}>` anchor that `navLinks` ids scroll to. Each section is also wrapped in `ErrorBoundary` in `App.jsx`. Shared Tailwind class strings (typography, padding) live in `src/styles.js`, and motion variants in `src/utils/motion.js`.

**3D rendering: one shared Canvas plus drei `View`s.** `App.jsx` mounts a single fixed, full-screen `<Canvas frameloop="demand" dpr={[1, 2]}>` behind the page. The Hero computer model (`canvas/Computers.jsx`) and the About earth (`canvas/Earth.jsx`) render into drei `<View track={ref}>` elements, which are tied to DOM refs on the Hero and About wrappers. The star field (`canvas/Stars.jsx`) renders in the same Canvas. Two exceptions create their own `<Canvas>`, each with its own WebGL context:
- Tech: one `BallCanvas` (`canvas/Ball.jsx`) per technology.
- Contact: `EarthCanvas` (`canvas/index.jsx`) mounts the same cached Earth scene a second time.

**WebGL safety — must be preserved:**
- `App.jsx` runs `useWebGL()` and renders the full-page `WebGLFallback` when WebGL is unavailable.
- Every 3D scene/View must be wrapped in `CanvasErrorBoundary` (`sectionType` picks the fallback). It catches render-loop errors and context loss per section. Never remove these wrappers. New 3D content must be wrapped the same way. (Today the per-icon `BallCanvas` instances in `Tech.jsx` and the `EarthCanvas` in `Contact.jsx` are not wrapped yet.)

**GPU resource cleanup.** `src/hooks/useCleanup.js` provides `useCleanup`, `disposeObject`, `disposeMaterial` and `disposeGLTFScene` for disposing geometries, materials and textures on unmount. Use these for new 3D components.

**Models** are gltf + textures in `public/desktop_pc/` and `public/planet/`, loaded with `useGLTF` plus `useGLTF.preload`.

## ESLint caveat

`npm run lint` passes, with 0 errors and some warnings:
- `react/prop-types` is off, because the project doesn't use PropTypes.
- R3F props are allowed through `react/no-unknown-property`'s `ignore` list (`R3F_PROPS`). This only applies in `src/App.jsx` and `src/components/canvas/**`.
- Legacy debt is downgraded to warnings for the specific files listed in `LEGACY` in `eslint.config.js`. When you clean up one of those files, remove it from `LEGACY` so its rules go back to being errors.

ESLint 9 flat config ignores `.eslintignore`. Use the `ignores` key in the config instead.
