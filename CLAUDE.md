# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal 3D portfolio: a Vite 5 single-page app in React 18 with React Three Fiber + drei, Tailwind 3 and framer-motion. Deployed to GitHub Pages at https://yel-hadr.github.io/ (the root), published into the `yel-hadr/yel-hadr.github.io` repo.

## Commands

```bash
npm run dev       # Vite dev server at http://localhost:5173/
npm run build     # production build into dist/
npm run preview   # serve dist/ locally
npm run lint      # eslint . (flat config in eslint.config.js)
npm run deploy    # predeploy runs lint + build, then gh-pages publishes dist/ to yel-hadr/yel-hadr.github.io (main)
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

## CI/CD

`.github/workflows/deploy.yml` ("CI/CD Pipeline"). On a PR to `main`, `lint-and-test` runs `npm ci`, lint, build and an asset-path check. On a push to `main`, `deploy-to-pages` publishes that job's `dist/` artifact with `peaceiris/actions-gh-pages` to `yel-hadr/yel-hadr.github.io` (`main`), so merging to `main` deploys. It authenticates with the `ACTIONS_DEPLOY_KEY` secret (a write deploy key on that repo). The EmailJS values come from `VITE_EMAILJS_*` repo secrets. The job deploys to the `yel-hadr.github.io` environment, not `github-pages`, because that one only allows the old `gh-pages` branch. The resume is `public/Youssef_Elhadraoui_Resume.pdf`, linked through `person.resume` (built from `import.meta.env.BASE_URL`) by `ResumeLink`.

## Base path and hosting (GitHub Pages)

`vite.config.js` sets `base: '/'`: the site is a GitHub Pages *user* site, so this source repo (`yel-hadr/portfolio`) is not what Pages serves. The build is published to the `main` branch of `yel-hadr/yel-hadr.github.io`, which serves https://yel-hadr.github.io/. There is no router; in-page navigation uses `#section` anchors. Consequences:
- The dev server URL is `http://localhost:5173/`.
- Imported assets and `url()` in CSS are rewritten by Vite automatically.
- Files in `public/` (the GLB model) are referenced relatively (`./planet/scene.glb`) or via `import.meta.env.BASE_URL`, so they keep working if the base path changes again.

## Architecture

**Data-driven content.** All portfolio content (`person` (name, alias, title, summary), `navLinks`, `services`, `technologies`, `experiences`, `projects`, `education`) lives in `src/constans/index.js`. Images live in `src/assets/` and are re-exported by name from `src/assets/index.js`, which the constants file imports. Section components just map over these arrays. Adding content means asset → `assets/index.js` export → entry in `constans/index.js`. Components should not need to change. The `/add-project` skill automates this.

**Sections and landmarks.** `App.jsx` renders a skip link, `Navbar` (`<nav>`), then `<main id="main">` with Hero, About, Experience, Tech, Works, Education and Contact, then `Footer`. Each section is wrapped in `ErrorBoundary`. Sections other than Hero use the `SectionWrapper(Component, idName)` HOC (`src/hoc/sectionWrapper.jsx`). It renders `<section id={idName} aria-labelledby={`${idName}-title`}>` with shared padding and the scroll reveal. The navbar offset comes from `scroll-padding-top` on `html`, so anchors, `scrollIntoView` and keyboard focus all clear the navbar. Don't add `scroll-mt` as well, because the two add up. `html` also sets `scroll-behavior: smooth`, but only under `prefers-reduced-motion: no-preference`. `SectionHeader` (`src/components/SectionHeader.jsx`) renders the `h2` with that id. `navLinks` ids must match section ids.

**Theme (dark/light).** Every color is a CSS variable: `--c-<token>` holds "R G B" channels (so `bg-background/80` works) and `--color-glass*` / `--color-line` are full colors. `:root` is the dark theme (the default) and `:root[data-theme='light']` is the light one, in `src/index.css`. An inline script in `index.html` sets `data-theme` and `lang` before the first paint (saved choice; dark by default; French if the browser is French). `ThemeProvider` (`src/theme/`, hook `useTheme` in `context.js`) persists the choice in localStorage, updates `meta[theme-color]` and adds a short `.theme-transition` cross-fade. The waves read `--c-primary/secondary/tertiary` and `--wave-alpha`, and redraw when `data-theme` changes. Components use tokens only, never hex, and every pair must pass AA in **both** themes. Text on orange uses `text-on-primary`, button hover uses `bg-primary-hover`, and orange text uses `text-primary-400`.

**i18n (EN/FR).** All user-facing text, including content, aria-labels and alt text, lives in `src/locales/<lang>/*.json`. `core.json` holds the site; `terminal`, `diagrams`, `status` and `til` are per-feature namespaces, merged in `src/i18n/dictionaries.js`. `src/constans/index.js` keeps only language-independent data (ids, links, assets, tags). Components call `const { t, lang, setLang } = useI18n()` (from `src/i18n/context.js`); `t('works.items.iot.name', vars)` returns a string or array with `{var}` interpolation and falls back to English. Keep the en and fr key sets identical. Switching language fades `main`/`footer`/nav links out and in (`.lang-switching`), updates `<html lang>`, the title and the meta description, and fires a `site:langchange` event that makes the waves ripple.

**Interactive features.**
- **Terminal** (`src/components/terminal/`): a lazy-loaded modal dialog that `App` opens from the navbar button or Ctrl+` (`e.code === 'Backquote'`; a modifier is required by WCAG 2.1.4; ignored while another `aria-modal` dialog is open). `commands.jsx` holds the command table (EN commands, French aliases, `goto` targets, completion); output comes from t(). Its module registers the `terminal` namespace via `registerNamespace`.
- **Architecture diagrams** (`src/components/diagrams/`): `ArchitectureModal` is lazy-loaded by `Works` for projects with a `diagram` id (`cloud1`, `iot`). Hand-built SVG through `InteractiveDiagram` (focusable nodes, a details panel, and the same content as a list); no Mermaid. The facts come from the project repos: re-read them before changing a label. It registers the `diagrams` namespace.
- **System status** (`src/components/SystemStatus.jsx` + `src/hooks/useGithubStatus.js`, in the footer): unauthenticated GitHub API (latest completed `deploy.yml` run on main, recent commits), fetched only when near view, cached 10 min in sessionStorage. It never shows green unless the latest finished run succeeded. Rate limit or error shows "Status unavailable".
- **Today I learned** (`src/components/Til.jsx`): data in `tils` (`src/constans/index.js`), text in `til.json`. Keep every note technically accurate, with no invented personal claims.

**Design system.** Tokens live in `tailwind.config.js`:
- Colors: `background`, `surface` / `surface-raised`, `foreground` / `foreground-muted`, `primary` (brand orange; `primary-400` for orange text, `primary-hover`), `on-primary`, `secondary` (violet), `tertiary` (blue, decorative), `success` / `danger` / `info`, `glass` / `glass-strong` (translucent card fills over the waves), `line` / `line-strong`. `text` is `foreground`. Icons are inline `currentColor` SVGs in `src/components/icons.jsx`; the white image icons don't work in light mode. All text pairs meet WCAG AA. Components take colors from tokens only: Tailwind classes, or the `--color-*` variables in `src/index.css` where a library or canvas needs a string (timeline styles, `WavesBackground`). The one exception is the three.js decal tint in `Ball.jsx`, a material color. Put dark text on orange; white on orange is only 2.95:1.
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
