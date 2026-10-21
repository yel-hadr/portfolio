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

**Sections and landmarks.** `App.jsx` renders a skip link, `Navbar` (`<nav>`), then `<main id="main">` with Hero, About, Experience, Tech, Works and Contact, then `Footer`. Each section is wrapped in `ErrorBoundary`. Sections other than Hero use the `SectionWrapper(Component, idName)` HOC (`src/hoc/sectionWrapper.jsx`). It renders `<section id={idName} aria-labelledby={`${idName}-title`}>` with shared padding, a `scroll-mt` offset for the fixed navbar, and the scroll reveal. `SectionHeader` (`src/components/SectionHeader.jsx`) renders the `h2` with that id. `navLinks` ids must match section ids.

**Design system.** Tokens live in `tailwind.config.js`:
- Colors: `background`, `surface` / `surface-raised`, `foreground` / `foreground-muted`, `primary` (brand orange #FF6500 plus 400/600), `secondary`, `line` / `line-strong`. All text pairs meet WCAG AA. Put dark text on orange; white on orange is only 2.95:1.
- Type: role presets in `src/styles.js` use Tailwind's default scale. Don't add arbitrary `text-[Npx]` sizes or hardcoded hexes.
- Motion: one shared reveal in `src/utils/motion.js`. `<MotionConfig reducedMotion="user">` at the root drops transform animations for reduced-motion users.

**3D rendering: one Canvas, many inline Views.**
- `App.jsx` mounts a single `<Canvas>` with `style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}` behind the content. It's an inline style because R3F's own inline `position: relative` beats Tailwind classes. The Canvas renders `<View.Port />`.
- Every scene is placed in the page with `<SceneView>` (`canvas/SceneView.jsx`), a drei inline `<View>` box whose children are tunnelled into the port: Hero `Computers`, About `Earth` (lg only), the 9 tech `Ball`s, Contact `Earth`, and the full-screen `Stars` (index 1, drawn first).
- The result is one WebGL context for the whole page. **Never add another `<Canvas>`.** Add a `SceneView` instead.
- Each scene sets its own camera with `ViewCamera`, except balls, which share the root camera.
- `frameloop` is `always`, or `demand` plus redraw-on-scroll when the user prefers reduced motion. Use `usePrefersReducedMotion()`, which is live, to stop `AutoRotate`, `Float`, star rotation and parallax.
- The opaque `herobg.png` backdrop must stay **below** the canvas, or it hides the hero model.

**WebGL safety — must be preserved:**
- `useWebGL()` probes for **WebGL2** (three ≥ r163 is WebGL2-only) and `App` renders the full-page `WebGLFallback` when it's missing.
- `CanvasErrorBoundary` wraps the Canvas itself (a failed renderer drops only the 3D layer) and every scene, inside `SceneView`. Inside the Canvas it renders `fallback ?? null`; DOM can't render there. `onError` makes the `SceneView` swap to its DOM `fallback` prop. `sectionType` is only a log label. Never remove these wrappers.
- Boundaries do **not** catch `useFrame` exceptions or context loss. Keep `useFrame` callbacks null-safe. A context restore triggers `invalidate()` via `onCreated`.

**GPU resources.** `useGLTF` / `useTexture` results are cached and shared. **Clone a cached scene per mount** (`Earth` does `scene.clone()`), because an Object3D has one parent. **Never dispose cached geometry, materials or textures** on unmount; the old `useCleanup` hook did, which blanked the Contact globe, and it was removed. R3F disposes the objects it creates declaratively.

**Models** are gltf + textures in `public/desktop_pc/` and `public/planet/`, loaded with `useGLTF` plus `useGLTF.preload`. Compression is planned for Phase 3.

## ESLint

`npm run lint` passes with 0 errors:
- `react/prop-types` is off, because the project doesn't use PropTypes.
- R3F props are allowed through `react/no-unknown-property`'s `ignore` list (`R3F_PROPS`). This only applies in `src/App.jsx` and `src/components/canvas/**`.
- The remaining warnings are `react-refresh/only-export-components` on the `SectionWrapper(...)` default exports.

ESLint 9 flat config ignores `.eslintignore`. Use the `ignores` key in the config instead.
