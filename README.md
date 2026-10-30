# Youssef El Hadraoui — Portfolio

Personal portfolio of Youssef El Hadraoui (Jebril), Software Engineer in cloud infrastructure and DevOps.

**Live site:** https://yel-hadr.github.io/
**Resume (PDF):** https://yel-hadr.github.io/Youssef_Elhadraoui_Resume.pdf. The site also has a "Download resume" button in the Hero and About sections.

Built with Vite 5, React 18, React Three Fiber and drei (one shared WebGL canvas), Tailwind CSS 3 and framer-motion. The background is a 2D-canvas interactive waves effect.

## Features

- **English / French.** Use the EN | FR toggle in the navbar. All text, content included, comes from JSON dictionaries in `src/locales/`.
- **Dark / light mode.** The theme toggle in the navbar switches every color, which come from CSS variables. In light mode the glass becomes frosted white and the waves turn pastel.
- **Terminal.** Press <kbd>Ctrl</kbd>+<kbd>`</kbd> or use the terminal button, then type `help`. Commands like `whoami`, `projects`, `skills`, `experience`, `contact`, `resume`, `goto <section>`, `lang fr` and `theme light` navigate the site and read the resume in terminal format.
- **Architecture diagrams.** The Cloud-1 and Inception-of-Things cards have a "View architecture" button that opens an interactive diagram of how the system works.
- **System status.** The footer shows the latest CI/CD deploy (linked to its run) and recent commits, live from the GitHub API.
- **Blog with RSS.** Posts are Markdown files in `content/blog/<slug>/<en|fr>.md`, indexed in `src/constans/posts.js`. The build turns them into static pages at [/blog/](https://yel-hadr.github.io/blog/) and [/fr/blog/](https://yel-hadr.github.io/fr/blog/), with feeds at [/blog/rss.xml](https://yel-hadr.github.io/blog/rss.xml) and [/fr/blog/rss.xml](https://yel-hadr.github.io/fr/blog/rss.xml). The home page shows the latest posts.
- **SEO.** Open Graph and Twitter cards (with a 1200x630 social image), JSON-LD for the profile (`ProfilePage`/`Person`), blog posts (`BlogPosting`), a sitemap and `robots.txt`.
- **Privacy-friendly analytics.** [Umami](https://umami.is/): no cookies, Do Not Track respected, and never active on localhost. It is off until you configure it (see below).
- **System status.** [/status/](https://yel-hadr.github.io/status/) shows uptime, response times and CI/CD pipeline health. A GitHub Actions monitor checks every 30 minutes, and the JSON endpoint [/status.json](https://yel-hadr.github.io/status.json) returns the same data for scripts. The footer widget shows the latest deploy and links to that page.

## Run locally

Requirements: Node.js 20 or newer, and npm.

```bash
npm install
npm run dev        # http://localhost:5173/
```

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
npm run lint       # ESLint
npm run format     # Prettier
```

### Contact form (Resend)

The contact form posts to a small Vercel function in [`contact-api/`](contact-api/README.md), which holds the Resend API key and sends the message. The site only needs the function's public URL. For local development, create a `.env` file in the repo root (it is gitignored) with:

```
VITE_CONTACT_ENDPOINT=https://<your-project>.vercel.app/api/contact
```

Without it the site still builds, but the form tells visitors it isn't configured. Never put the Resend key in `.env` or in the site: `VITE_*` values end up in the public JavaScript.

## CI/CD pipeline

`.github/workflows/deploy.yml` ("CI/CD Pipeline") runs on GitHub Actions:

- **Pull requests to `main`**: the `lint-and-test` job runs `npm ci`, `npm run lint`, the contact endpoint's tests and `npm run build`, and checks that the built asset paths are correct. The result appears as a PR check.
- **Push or merge to `main`**: the same checks run. If they pass, the `deploy-to-pages` job publishes that exact build to GitHub Pages. **Merging to `main` deploys the site automatically.** If lint or the build fails, nothing is deployed.

How the site is served: https://yel-hadr.github.io/ is a GitHub Pages *user* site, so Pages serves the `main` branch of [`yel-hadr/yel-hadr.github.io`](https://github.com/yel-hadr/yel-hadr.github.io), not this repo. Vite's `base` is therefore `'/'`. The deploy job pushes `dist/` there with [`peaceiris/actions-gh-pages`](https://github.com/peaceiris/actions-gh-pages), using a write-enabled deploy key. Its private half is this repo's `ACTIONS_DEPLOY_KEY` secret.

Repository secrets used by the workflow:

| Secret | Purpose |
|---|---|
| `ACTIONS_DEPLOY_KEY` | SSH key allowed to push to `yel-hadr/yel-hadr.github.io` (required to deploy) |

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
