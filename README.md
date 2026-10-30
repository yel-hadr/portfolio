# Youssef El Hadraoui — Portfolio

Personal portfolio of Youssef El Hadraoui (Jebril), Software Engineer in cloud infrastructure and DevOps.

**Live site:** https://yel-hadr.github.io/
**Resume (PDF):** https://yel-hadr.github.io/Youssef_Elhadraoui_Resume.pdf. The site also has a "Download resume" button in the Hero and About sections.

Built with Vite 6, React 19 (with the React Compiler), React Three Fiber 9 and drei 10 (one shared WebGL canvas), Tailwind CSS 4 and framer-motion 12. The background is a 2D-canvas interactive waves effect. The contact form sends through [Resend](https://resend.com/) from a small Vercel function (`contact-api/`).

## Features

- **English / French.** Use the EN | FR toggle in the navbar. All text, content included, comes from JSON dictionaries in `src/locales/`.
- **Dark / light mode.** The theme toggle in the navbar switches every color, which come from CSS variables. Dark is "Midnight Obsidian" (slate, amber and ice cyan); in light mode the glass becomes cream and the waves turn pastel. The color tokens are chosen for WCAG AA contrast in both.
- **Game Mode.** "Enter Game Mode" in the Hero (or the footer) opens a first-person tour of the portfolio, built on the author's 42 cub3D raycaster: six rooms, one profile section each, threats to neutralize, crew to talk to, a radar and a mission tracker. It has a text-only mode, a pause menu, graphics, Reduce flashing and high-contrast settings, and follows reduced motion. Desktop only (phones get a message and the text version).
- **Live demos.** The cub3D and FdF project cards have a "Run live demo" button: the original 42 raycaster map, and six FdF wireframe maps (Julia and Mandelbrot sets, a landscape…) in isometric or perspective view.
- **Mini-games.** "Play games" in the footer: Packet Snake (keyboard, swipe or D-pad) and a terminal typing challenge, with best scores kept in the browser.
- **Contact form.** Validated in the browser and again by the endpoint, which rate-limits senders and drops bots; messages arrive as a laid-out email you can reply to.
- **Terminal.** Press <kbd>Ctrl</kbd>+<kbd>`</kbd> or use the terminal button, then type `help`. Commands like `whoami`, `projects`, `skills`, `experience`, `contact`, `resume`, `goto <section>`, `lang fr` and `theme light` navigate the site and read the resume in terminal format.
- **Architecture diagrams.** The Cloud-1 and Inception-of-Things cards have a "View architecture" button that opens an interactive diagram of how the system works.
- **System status.** The footer shows the latest CI/CD deploy (linked to its run) and recent commits, live from the GitHub API.
- **Blog with RSS.** Posts are Markdown files in `content/blog/<slug>/<en|fr>.md`, indexed in `src/constans/posts.js`. The build turns them into static pages at [/blog/](https://yel-hadr.github.io/blog/) and [/fr/blog/](https://yel-hadr.github.io/fr/blog/), with feeds at [/blog/rss.xml](https://yel-hadr.github.io/blog/rss.xml) and [/fr/blog/rss.xml](https://yel-hadr.github.io/fr/blog/rss.xml). The home page shows the latest posts.
- **SEO.** Open Graph and Twitter cards (with a 1200x630 social image), JSON-LD for the profile (`ProfilePage`/`Person`), blog posts (`BlogPosting`), a sitemap and `robots.txt`.
- **Privacy-friendly analytics.** [Umami](https://umami.is/): no cookies, Do Not Track respected, and never active on localhost. It is off until you configure it (see below).
- **System status.** [/status/](https://yel-hadr.github.io/status/) shows uptime, response times and CI/CD pipeline health. A GitHub Actions monitor checks every 30 minutes, and the JSON endpoint [/status.json](https://yel-hadr.github.io/status.json) returns the same data for scripts. The footer widget shows the latest deploy and links to that page.

## Run locally

Requirements: Node.js 22 (as in CI), and npm.

```bash
npm install
npm run dev        # http://localhost:5173/
```

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
npm run lint       # ESLint
npm run format     # Prettier (format:check only checks)
npm run compiler:report   # which components the React Compiler skips (should be none)
(cd contact-api && npm install && npm test)   # the contact endpoint's tests
```

### Contact form (Resend)

The contact form posts to a small Vercel function in [`contact-api/`](contact-api/README.md), which holds the Resend API key and sends the message. The site only needs the function's public URL. For local development, create a `.env` file in the repo root (it is gitignored) with:

```
VITE_CONTACT_ENDPOINT=https://<your-project>.vercel.app/api/contact
```

Without it the site still builds, but the form tells visitors it isn't configured. Never put the Resend key in `.env` or in the site: `VITE_*` values end up in the public JavaScript.

## CI/CD pipeline

`.github/workflows/deploy.yml` ("CI/CD Pipeline") runs on GitHub Actions:

- **Pull requests to `main`**: `lint-and-test` runs `npm ci`, a production dependency audit, lint, `format:check`, the contact endpoint's own install, audit and tests, and the build, then checks the built asset paths. `lighthouse` then runs Lighthouse CI on that build: desktop must score 0.9 or more in performance, accessibility and best practices; mobile in accessibility and best practices (its performance only warns).
- **Push or merge to `main`**: the same checks run. If they pass, `deploy-to-pages` publishes that exact build to GitHub Pages and `deploy-contact-api` deploys the contact endpoint to Vercel. **Merging to `main` deploys the site automatically.** If a check fails, nothing is deployed.

How the site is served: https://yel-hadr.github.io/ is a GitHub Pages *user* site, so Pages serves the `main` branch of [`yel-hadr/yel-hadr.github.io`](https://github.com/yel-hadr/yel-hadr.github.io), not this repo. Vite's `base` is therefore `'/'`. The deploy job pushes `dist/` there with [`peaceiris/actions-gh-pages`](https://github.com/peaceiris/actions-gh-pages), using a write-enabled deploy key. Its private half is this repo's `ACTIONS_DEPLOY_KEY` secret.

Repository secrets used by the workflow:

| Secret | Purpose |
|---|---|
| `ACTIONS_DEPLOY_KEY` | SSH key allowed to push to `yel-hadr/yel-hadr.github.io` (required to deploy) |
| `VERCEL_TOKEN` | Vercel access token: deploys `contact-api/` |
| `RESEND_API_KEY` | Resend API key, passed only to the contact function (never to the site) |
| `CONTACT_TO` | Where contact messages go (with Resend's test sender, your Resend account's address) |

And one repository **variable**, `VITE_CONTACT_ENDPOINT`: the contact function's public URL, built into the site. See [`contact-api/README.md`](contact-api/README.md).

To deploy by hand, without CI: `npm run deploy`. It lints, builds and publishes `dist/` to the same repo and branch.

## Optional services

All of these are off until configured, and the site works without them.

| What | Where (GitHub repo settings) | Value |
|---|---|---|
| Umami analytics | Variables: `VITE_UMAMI_WEBSITE_ID` (and `VITE_UMAMI_SCRIPT_URL` if self-hosted) | The Website ID from Umami Cloud (free tier) for the domain `yel-hadr.github.io` |
| Grafana dashboard on /status/ | Variable: `VITE_GRAFANA_DASHBOARD_URL` | Import `grafana/portfolio-status.dashboard.json` (Dashboards → Import, pick the Grafana Cloud Prometheus data source), share it publicly, then set this variable to its https URL |
| Monitor metrics in Grafana Cloud | Secrets: `GRAFANA_INFLUX_URL`, `GRAFANA_INFLUX_USER`, `GRAFANA_INFLUX_TOKEN` | The Influx write endpoint, the metrics instance ID and a token with metrics:write |
| Your own servers on /status/ | `status.config.json` → `servers` | `{ "name", "url", "method", "expectStatus", "timeoutMs" }`, public URLs only |

After adding the `GRAFANA_INFLUX_*` secrets, run Actions → "Status monitor" → Run workflow with "Backfill Grafana" ticked, so the dashboard starts with the last 7 days.

The status monitor (Actions → "Status monitor") uses `GITHUB_TOKEN` and the existing deploy key. Its 30-minute cadence needs one environment, because GitHub runs cron schedules best-effort (every 2–7 hours in practice): each run waits on that environment's timer, then dispatches the next. Create it once (Settings → Environments → New environment `status-cadence`, wait timer 28 minutes), or:

```bash
gh api -X PUT repos/yel-hadr/portfolio/environments/status-cadence -F wait_timer=28
```

Then run the workflow once on `main` to start the chain. The cron stays as a backstop that restarts it. To stop it, disable the workflow.

## Credits

- 3D globe model from Sketchfab (license in `public/planet/license.txt`).
- Technology icons from [devicon](https://github.com/devicons/devicon), MIT license (`src/assets/tech/LICENSE-devicon.txt`).
- The waves background is adapted from ReactBits' "Interactive Waves Background".
