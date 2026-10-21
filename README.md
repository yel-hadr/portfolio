# Youssef El Hadraoui — Portfolio

Personal portfolio of Youssef El Hadraoui (Jebril), Software Engineer in cloud infrastructure and DevOps.

**Live site:** https://yel-hadr.github.io/
**Resume (PDF):** https://yel-hadr.github.io/Youssef_Elhadraoui_Resume.pdf. The site also has a "Download resume" button in the Hero and About sections.

Built with Vite 5, React 18, React Three Fiber and drei (one shared WebGL canvas), Tailwind CSS 3 and framer-motion. The background is a 2D-canvas interactive waves effect.

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

### Contact form (EmailJS)

The contact form sends through EmailJS. Create a `.env` file in the repo root. It is gitignored. Add:

```
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
```

Without these values the site still builds, but the form tells visitors it isn't configured.

## CI/CD pipeline

`.github/workflows/deploy.yml` ("CI/CD Pipeline") runs on GitHub Actions:

- **Pull requests to `main`**: the `lint-and-test` job runs `npm ci`, `npm run lint` and `npm run build`, and checks that the built asset paths are correct. The result appears as a PR check.
- **Push or merge to `main`**: the same checks run. If they pass, the `deploy-to-pages` job publishes that exact build to GitHub Pages. **Merging to `main` deploys the site automatically.** If lint or the build fails, nothing is deployed.

How the site is served: https://yel-hadr.github.io/ is a GitHub Pages *user* site, so Pages serves the `main` branch of [`yel-hadr/yel-hadr.github.io`](https://github.com/yel-hadr/yel-hadr.github.io), not this repo. Vite's `base` is therefore `'/'`. The deploy job pushes `dist/` there with [`peaceiris/actions-gh-pages`](https://github.com/peaceiris/actions-gh-pages), using a write-enabled deploy key. Its private half is this repo's `ACTIONS_DEPLOY_KEY` secret.

Repository secrets used by the workflow:

| Secret | Purpose |
|---|---|
| `ACTIONS_DEPLOY_KEY` | SSH key allowed to push to `yel-hadr/yel-hadr.github.io` (required to deploy) |
| `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY` | EmailJS values for the contact form (optional) |

To deploy by hand, without CI: `npm run deploy`. It lints, builds and publishes `dist/` to the same repo and branch.

## Credits

- 3D globe model from Sketchfab (license in `public/planet/license.txt`).
- Technology icons from [devicon](https://github.com/devicons/devicon), MIT license (`src/assets/tech/LICENSE-devicon.txt`).
- The waves background is adapted from ReactBits' "Interactive Waves Background".
