# Pre-flight audit — 2026-10-30

A full audit of the portfolio before job hunting, run against `main` at `15d9960`, with the
fixes in the same pull request as this file. Findings are graded Critical / High / Medium / Low;
Critical and High are fixed here, Medium and Low wait for the owner's approval.

**Verdict:** ready for production. No Critical findings. The High findings in the code are fixed.
One High finding is the owner's to settle: the resume PDF and the site disagree on some
experience and education details.

## How it was checked

| Area | Method | Result |
| --- | --- | --- |
| Performance | Lighthouse (local, production build): desktop ×5, mobile ×3; CI's Lighthouse gates on this PR | Desktop 100 / 100 / 100 / 100 on every run (LCP 0.6 s, TBT 0 ms, CLS 0.004); mobile performance 92–93, LCP 2.7 s |
| First paint | gzipped size of what `index.html` loads before the first paint | 158.4 KB; three.js and R3F are never preloaded |
| Whole bundle | gzipped size of all 37 JS and CSS chunks | 637.5 KB (see M1) |
| React Compiler | `npm run compiler:report` | 163 components and hooks compiled, none skipped |
| Memory | GPU object counts and the JS heap after forced GC, over repeated cycles | FdF: 6 maps × 10, GPU counts constant. Weapons: 120 switches, flat after the first draw. Demo and Game Mode cycles: see M2 |
| Security | Claude Security (whole repo, medium effort, verified); Aikido dependencies, secrets and IaC; bundle grep for key patterns; XSS sinks | 0 findings; 5 dependency advisories, all in build and dev tools; no secrets in the bundle; one `innerHTML`, a constant icon |
| Accessibility | WCAG 2.2 AA source review of every component in both themes | No Critical or High; see M3 and M4 and the Low list |
| Code | whole-codebase review, simplification review, lint, build | Lint 0, build 0 warnings after H2 |
| Content | EN/FR review of every locale file and blog post; facts compared across the site, metadata and resume | Key sets identical; see H4, M5 and M6 |
| Inputs | Terminal: empty, unknown, injected markup and script, 2000 characters. Contact form: empty, invalid email, success, rate-limited | All 13 checks pass |
| Browsers | Chromium (Chrome and Edge's engine): every Playwright suite. Firefox: pages at 1440 and 390, WebGL2, FdF, cub3D, Game Mode, reduced motion | All pass. WebKit (Safari) could not run on this Linux host |
| Network | Slow 3G (400 kbps, 400 ms) with 4× CPU slowdown; JavaScript disabled | Hero at 6.0 s, sections at 9.1 s, 257 KB, no errors. Without JavaScript the home page is blank (M7); the blog pages work |
| Links | every link on the home, blog, status and FR blog pages, plus the diagrams' repositories | All answer 200 (LinkedIn refuses bots with 999) |
| CI/CD | recent runs, secrets referenced against secrets set | Green; all required secrets set, the optional Grafana/Umami ones unset by choice |

## Fixed here

- **H1. The contact endpoint had no rate limiting.**
  - The problem: the origin check only stops browsers on other sites, and the honeypot only stops naive bots, so a script could flood the inbox and spend the Resend quota (about 100 a day on the free plan).
  - The fix: `contact-api/lib/rateLimit.js` allows 5 messages per client per 10 minutes and 30 per hour in all, answering 429 with `Retry-After`. The form says "too many messages" in EN and FR. Tests: 21/21.
  - The counts live in the function's memory; the durable layer is a Vercel Firewall rule (R1).
- **H2. The build printed a warning.** The three.js chunk is 690 kB minified, over Vite's 500 kB default. It is one library, loaded only by the 3D layer, the demos and Game Mode, so the limit now sits just above it (`vite.config.js`, with the reason). The build is now warning-free.
- **H3. README was out of date.**
  - It listed Vite 5, React 18 and Tailwind 3, and left out Game Mode, the live demos, the mini-games and the contact form.
  - Its CI section left out the audits and the Lighthouse gates, and its secrets table had one entry.
  - All are corrected from the code. `contact-api/README.md` documents the limits and the Firewall rule.

## Applied after review (owner-approved batch)

- **H4 (resume vs site), settled by the owner.**
  - WePartner now uses the resume's description and dates (Software Engineering Intern, May–Nov 2025: the Directorate of Rural Affairs information system, Wefree V2).
  - Education keeps 42 Paris (RNCP Level 7, Sept 2026).
  - Legaliox keeps "Lead Backend Engineer & DevOps Infrastructure Lead".
  - The PDF's "Mai 2025" is left to the owner to correct.
- **M3:** the 3D views' focus ring now sits on a band of the page background (`viewFocusRing` in `src/styles.js`), so it keeps its contrast over any scene.
- **M5:** French text uses a non-breaking space before `: ; ? !`. This covers 155 places in the FR locales (string values only, not keys) and 51 places in the FR blog posts (code blocks and spans left alone).
- **M6, content:**
  - Two blog grammar fixes.
  - The experience timeline has dates, now in the locales (`experience.items.<id>.date`), and the timeline, terminal and Game Mode all read them.
  - The Infinitive Byte internship (Feb–Apr 2025) is added from the resume.
  - The unsupported "microservices" claim now reads "multi-tenant SaaS backends", in the summary and so in the JSON-LD.
  - Stale CLAUDE.md lines are corrected.
- **M7:** `index.html` has a `<noscript>` block with the name, title, resume, email, GitHub, LinkedIn and blog links, styled with the site's tokens.
- **M8:** the contact request aborts after 15 s (`AbortSignal.timeout`) and says it failed.
- **R2:** the old deploy key on `yel-hadr/yel-hadr.github.io` is removed; only the current one remains.
- **Deferred by the owner:** M1 (bundle size accepted), M2 (canvas retention, later cleanup), M4 (the OS reduced-motion setting is enough).

## Needs the owner

- **H4, what is left: the resume PDF.** The site now follows the owner's decisions (see above). The English PDF still says "Mai 2025" for "May 2025": the owner fixes it in `public/Youssef_Elhadraoui_Resume.pdf`.
- **R1 (owner will do it).** Add a Vercel Firewall rate-limit rule on `/api/contact` (for example 10 requests per minute per IP). It applies before the function, in every instance.
- **R3 (owner will do it).** Check Safari on a Mac or an iPhone (or a cloud browser service). WebKit could not run here.

## Medium, as found (M3 and M5–M8 applied above; M1, M2 and M4 deferred)

- **M1. The whole bundle is 637.5 KB gzipped, over the 550 KB target.**
  - Largest chunks: three.js 177, R3F 84, React 73.5, app 36, Game Mode 28, framer-motion 27, post-processing 24, status page 19.
  - A first visit downloads 158 KB; the rest loads with the 3D layer, the demos, Game Mode and the status page.
  - Options: accept it, or trim three.js imports and drop post-processing on the Low graphics tier.
- **M2. Each demo or Game Mode visit leaves the old page 3D canvas in memory.**
  - The page's 3D layer is rebuilt on close, and the previous canvas and its WebGL context stay reachable: 12 detached canvases after 11 opens.
  - Their contexts are lost, so the GPU memory is freed. The JS heap grows about 0.25–0.6 MB per visit, and 30 cycles showed no errors.
  - Fix: find the retainer with a heap-snapshot diff (suspects: drei's View tunnels, a stored `invalidate` or `gl`), then release it on unmount.
- **M3. The 3D views' focus ring vanishes over some scenes.** It measures 1.27–2.53:1 over the cub3D floor and ceiling and FdF's night palette (`src/styles.js`, `viewFocusRing`). Fix: a background-colored inset band under the ring.
- **M4. Ambient motion can only be stopped with the OS reduced-motion setting** (the waves, Earth and the tech balls; WCAG 2.2.2). Fix: a pause toggle in the navbar that feeds `usePrefersReducedMotion`.
- **M5. French punctuation can wrap onto its own line.** Most French strings put a plain space before `: ; ? !`, where French typography uses a non-breaking one. Fix: a non-breaking space in `t()` and the blog renderer, or in the strings.
- **M6. Content and docs need a few corrections:**
  - two blog grammar fixes (FR "vous vous attendez", EN "has been generally available");
  - the experience timeline has no dates;
  - the Infinitive Byte internship is on the resume but not the site;
  - the "microservices" claim is not backed by the resume;
  - stale CLAUDE.md lines (post-processing 2.x / R3F 8, "no test suite", `#050816`, "9 tech balls").
- **M7. No fallback without JavaScript:** the home page is blank. Fix: a `<noscript>` block in `index.html` with the name, title, links to the blog and resume, and contact details.
- **M8. The contact form's request has no timeout.** If the endpoint hangs, the form stays "Sending…" until reload. Fix: `signal: AbortSignal.timeout(15000)`.

## Low (not fixed; awaiting approval)

- **Accessibility:**
  - The terminal is not portaled or inert like the other dialogs.
  - The status chart tooltip has no Escape.
  - Muted text over the dark waves can reach 2.72:1 where a line crosses it.
  - Some HUD text reaches 4.24:1 over bloom.
  - The diagram live region speaks on hover.
  - Deep links do not move focus.
  - The cub3D touch buttons ignore Enter and Space.
  - The error heading shows a raw section id.
  - The footer's "Play games" lacks `aria-haspopup`.
- **Code:**
  - Dead files and exports: `src/components/index.js`, the `menu`/`close`/`github` assets, `public/vite.svg`, the `maath` and `@types/react*` dependencies.
  - Duplicated helpers: `percentile`, `isGithubUrl`.
  - Latent: string replacement in `build/seo.js`, duplicate blog heading ids, `$REF` in a jq program in `status.yml`.
  - No try/catch around the Resend call.
  - Non-503 failures all say "check your connection".
  - The package name is "porfoliov2".
- **Dependencies (dev only):**
  - prettier 3.9.8 has an advisory: upgrade to 3.9.10.
  - nanoid, picomatch and fs-extra come in through vite and gh-pages: picomatch has no fix yet, and the other two need upstream releases.
- **Simplification:** 15 behavior-preserving refactors, the largest a shared `Cub3D/grid.js` for line of sight and collision, and a `GameDialog` frame for the HUD's dialogs.
- **Content:**
  - Two project tags show in English on the French page.
  - Terminology is inconsistent (1337, NGINX/Nginx, K3s/k3s, "Play games"/"Play a game").
  - The EN quotes mix straight and curly apostrophes.
- **By design, to confirm:** the site starts dark whatever the OS color scheme says, and remembers the visitor's choice.
