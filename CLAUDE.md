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
npm run format    # prettier --write . (config: .prettierrc.json; ignores *.md, .claude, public)
npm run format:check
```

There is no test suite. Prettier style is semicolons, single quotes in JS and JSX, and 100-character lines.

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

`vite.config.js` sets `base: '/portfolio/'`. There is no router; in-page navigation uses `#section` anchors. Consequences:
- The dev server URL is `http://localhost:5173/portfolio/`.
- Imported assets and `url()` in CSS are rewritten by Vite automatically.
- Files in `public/` (the GLB models) must be referenced relatively (`./planet/scene.glb`) or via `import.meta.env.BASE_URL`. A leading `/` will 404 in production.

## Architecture

**Data-driven content.** All portfolio content (`person` (name, alias, title, summary), `navLinks`, `services`, `technologies`, `experiences`, `projects`, `education`) lives in `src/constans/index.js`. Images live in `src/assets/` and are re-exported by name from `src/assets/index.js`, which the constants file imports. Section components just map over these arrays. Adding content means asset → `assets/index.js` export → entry in `constans/index.js`. Components should not need to change. The `/add-project` skill automates this.

**Sections and landmarks.** `App.jsx` renders a skip link, `Navbar` (`<nav>`), then `<main id="main">` with Hero, About, Experience, Tech, Works, Education and Contact, then `Footer`. Each section is wrapped in `ErrorBoundary`. Sections other than Hero use the `SectionWrapper(Component, idName)` HOC (`src/hoc/sectionWrapper.jsx`). It renders `<section id={idName} aria-labelledby={`${idName}-title`}>` with shared padding and the scroll reveal. The navbar offset comes from `scroll-padding-top` on `html`, so anchors, `scrollIntoView` and keyboard focus all clear the navbar. Don't add `scroll-mt` as well, because the two add up. `html` also sets `scroll-behavior: smooth`, but only under `prefers-reduced-motion: no-preference`. `SectionHeader` (`src/components/SectionHeader.jsx`) renders the `h2` with that id. `navLinks` ids must match section ids.

**Design system.** Tokens live in `tailwind.config.js`:
- Colors: `background`, `surface` / `surface-raised`, `foreground` / `foreground-muted`, `primary` (brand orange #FF6500 plus 400/600), `secondary` (violet), `tertiary` (deep blue, decorative: the far end of the waves), `glass` / `glass-strong` (translucent surface for cards over the waves), `line` / `line-strong`. `text` is `foreground`. All text pairs meet WCAG AA. Components take colors from tokens only: Tailwind classes, or the `--color-*` variables in `src/index.css` where a library or canvas needs a string (timeline styles, `WavesBackground`). The one exception is the three.js decal tint in `Ball.jsx`, a material color. Put dark text on orange; white on orange is only 2.95:1.
- Type: Poppins is self-hosted with `@fontsource/poppins`, imported in `src/main.jsx`: the latin subset, weights 400/500/600/700/900, `font-display: swap`. Don't add a Google Fonts `<link>`; that third-party, render-blocking stylesheet doubled phone LCP in measurements. Role presets in `src/styles.js` use Tailwind's default scale. Don't add arbitrary `text-[Npx]` sizes or hardcoded hexes.
- Cards: the `.card-glass` component class (`src/index.css`: glass fill, `backdrop-blur-md`, hairline border, `rounded-3xl`), exposed as `styles.card`. Buttons: `styles.buttonPrimary` (dark text on orange) and `styles.buttonGhost`.
- Motion: one shared reveal in `src/utils/motion.js`. `<MotionConfig reducedMotion="user">` at the root drops transform animations for reduced-motion users.

**Background.** `WavesBackground.jsx` is a fixed, `aria-hidden` 2D canvas (not WebGL) behind everything: Perlin-noise lines ported from the ReactBits "Interactive Waves Background", stroked with an orange → violet → blue gradient at low alpha, plus dark overlays for text contrast. It caps DPR at 1.5, draws at about 30 fps, listens to the pointer passively, and draws one still frame under reduced motion. Keep text on `.card-glass` or over the overlays; don't raise the line alpha much without rechecking contrast.

**3D rendering: one Canvas, many inline Views.**
- `canvas/Scene3D.jsx` holds the single `<Canvas>`, lazily loaded by `App.jsx`, with `<View.Port />`, `dpr={[1, 1.5]}` and `powerPreference: 'default'`. Its `style` is inline because R3F's own inline `position: relative` beats Tailwind classes.
- **The canvas scrolls with the page; it is not `position: fixed`.** A fixed canvas only changes when the main thread draws, while browsers scroll the page on the compositor thread. Scenes lagged their DOM boxes, and in Firefox and on touch they stayed in place until scrolling stopped. Instead the Canvas sits in an absolutely positioned layer at the top of the page (`h-[125vh]`, `will-change-transform`, `aria-hidden`, no pointer events). `ScrollSync` is a `useFrame` at priority -1, so it runs before drei's views without taking over rendering. Each rendered frame it sets `translate3d(0, scrollY, 0)`, so the compositor carries the drawn pixels with the page between frames. The extra 25vh below the viewport is overscan: a view scrolling up into the screen is already drawn. There is none above, because drei never draws a view whose bottom is above the viewport. Browsers without `overflow: clip` (Safari 15, Chrome < 90, Firefox < 81) keep a plain fixed canvas (`CLIP` in `Scene3D.jsx`). `resize={{ scroll: false }}` stops R3F's debounced re-measure on scroll. The canvas is always at the viewport's top-left when drawn, and `ScrollSync` corrects R3F's stored `size.top/left` if its first asynchronous measurement landed mid-scroll (a deep link). `App`'s root has `overflow-clip`, so the layer never makes the page longer. Don't lerp scene positions toward the scroll: drei scissors each view to its box, so any smoothing is visible lag.
- **Code splitting:** three, R3F and drei are reached only through lazy modules: `Scene3D`, `SceneViewImpl` and the scene components exported by `canvas/index.jsx`. `vite.config.js` `manualChunks` keeps them in `vendor-three` and `vendor-r3f`, off the first paint. Don't import `three`, `@react-three/*` or `maath` from DOM components; route them through those lazy modules. Check `dist/index.html`: it should only `modulepreload` `vendor-react` and `vendor-motion`.
- Every scene is placed in the page with `<SceneView>` (`canvas/SceneView.jsx`), a drei inline `<View>` box whose children are tunnelled into the port: the 9 tech `Ball`s and the Contact `Earth`. (The hero desk model and the star field were removed when the waves background and profile photo replaced them.)
- The result is one WebGL context for the whole page (the waves are a 2D canvas). **Never add another `<Canvas>`.** Add a `SceneView` instead.
- Each scene sets its own camera with `ViewCamera`, except balls, which share the root camera.
- `frameloop` is always `demand`. `FrameDriver` (in `Scene3D`) redraws on scroll, resize and pointer moves, and ticks ambient motion at about 30 fps. Under reduced motion it redraws only on scroll and resize. So animate with `delta` or `MathUtils.damp`, never per-frame constants. Use `usePrefersReducedMotion()`, which is live, to stop `AutoRotate` and `Float`.

**WebGL safety — must be preserved:**
- `useWebGL()` probes for **WebGL2** (three ≥ r163 is WebGL2-only). Without it (or when the lazy 3D layer later fails: renderer creation or chunk load), `App` turns `WebGLContext` off, so the 3D layer is skipped and every `SceneView` renders its static `fallback`; the content still renders, with `WebGLFallback` shown as a notice after the hero.
- `CanvasErrorBoundary` wraps the lazy 3D layer, catching a failed renderer or a failed chunk load and dropping only the 3D layer. It also wraps each `SceneView`'s lazy half (outer, for a chunk failure) and every scene (inner, inside `SceneViewImpl`). Inside the Canvas it renders `fallback ?? null`; DOM can't render there. `onError` makes the `SceneView` swap to its DOM `fallback` prop. `sectionType` is only a log label. Never remove these wrappers.
- Boundaries do **not** catch `useFrame` exceptions or context loss. Keep `useFrame` callbacks null-safe. A context restore triggers `invalidate()` via `onCreated`.

**GPU resources.** `useGLTF` / `useTexture` results are cached and shared. **Clone a cached scene per mount** (`Earth` does `scene.clone()`), because an Object3D has one parent. **Never dispose cached geometry, materials or textures** on unmount; the old `useCleanup` hook did, which blanked the Contact globe, and it was removed. R3F disposes the objects it creates declaratively.

**Models** are meshopt-compressed GLBs with WebP textures in `public/planet/scene.glb`. They're loaded with `useGLTF` + `useGLTF.preload`; drei's bundled MeshoptDecoder means no CDN decoder is needed. Keep each folder's `license.txt` (Sketchfab attribution). To regenerate from a source gltf, run:
`npx --yes @gltf-transform/cli@4.5.1 optimize <in>.gltf <out>.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false`
Leave `--simplify false`: simplify removes a third of the triangles to save only about 120 KB.

## ESLint

`npm run lint` passes with 0 errors:
- `react/prop-types` is off, because the project doesn't use PropTypes.
- R3F props are allowed through `react/no-unknown-property`'s `ignore` list (`R3F_PROPS`). This only applies in `src/App.jsx` and `src/components/canvas/**`.
- It runs with no warnings. Name wrapped sections (`const AboutSection = SectionWrapper(About, 'about')`) so React Fast Refresh keeps working.

ESLint 9 flat config ignores `.eslintignore`. Use the `ignores` key in the config instead.
