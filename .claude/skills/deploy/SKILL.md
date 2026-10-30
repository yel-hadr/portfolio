---
name: deploy
description: Build and publish the portfolio to GitHub Pages at the root of https://yel-hadr.github.io/. Runs preflight checks (git state, base path, contact endpoint env, lint, build, dist/ audit), publishes dist/ to the main branch of yel-hadr/yel-hadr.github.io after explicit confirmation, then verifies the live site with curl and Playwright.
disable-model-invocation: true
---

# Deploy to GitHub Pages

Normally you don't need this skill: merging to `main` deploys through the CI/CD Pipeline (`.github/workflows/deploy.yml`). Use it for a manual deploy, for example when Actions is unavailable or to test a branch build live.

Publishes `dist/` to the `main` branch of github.com/yel-hadr/yel-hadr.github.io (the GitHub Pages *user* site), served at the root https://yel-hadr.github.io/. This source repo (yel-hadr/portfolio) is not published itself.

Hard rules for this whole skill:
- Never print env values or any secret. Print only variable names and counts. Env file contents may only be piped into `grep -c` / name-only `grep -o`, never shown (no bare `cat`, `head`, `grep` without `-c`, or Read tool on `.env*`).
- Never edit `dist/`, `.env*` or `package-lock.json` by hand. If a check fails, fix the source and rebuild.
- When a step says **stop**, report what failed and wait for the user. Do not work around it.
- Run every command from the repo root `/home/youssefelhadraoui/Desktop/portfolio`.

## 1. Preflight

```bash
git status --short
git branch --show-current
git fetch origin && git status -sb | head -1     # ahead/behind origin/main
git remote get-url origin                         # the source repo: github.com/yel-hadr/portfolio
gh repo view yel-hadr/yel-hadr.github.io --json name --jq .name   # the publish target must exist
test -x node_modules/.bin/gh-pages && echo "gh-pages OK" || echo "gh-pages MISSING"
gh auth status 2>&1 | grep -E 'Logged in|not logged'   # needed for steps 7-8; never print tokens
```

- Uncommitted changes, or a branch other than `main`: warn and ask whether to continue. The deploy publishes whatever is in the working tree, not what is on GitHub.
- `main` ahead of `origin/main`: mention it. The live site will not match the repo until the user pushes.
- `yel-hadr/yel-hadr.github.io` missing or not reachable with the current `gh` login: **stop**. gh-pages pushes there (`-r`), not to `origin`.
- `gh-pages MISSING`: tell the user to run `npm install`, then **stop**.
- `gh` not logged in: tell the user to run `gh auth login` (steps 7-8 need it), then **stop**.

## 2. Base path

```bash
grep -n "base:" vite.config.js                                   # must be: base: '/'
grep -rnE "[\"'\`(]/(planet|logo\.svg|vite\.svg)" src  # must print nothing
```

Files in `public/` (`planet/`, `logo.svg`, `vite.svg`) must be referenced relatively (`./planet/scene.glb`, as in `canvas/Earth.jsx`) or through `import.meta.env.BASE_URL`. A leading `/` 404s in production. `index.html` uses `/src/...` paths, which is fine because Vite rewrites them. If any check fails, **stop** and show the offending lines.

## 3. Contact endpoint env (names and counts only)

Vite's production build loads `.env`, `.env.local`, `.env.production` and `.env.production.local`.

```bash
envcat() { cat .env .env.local .env.production .env.production.local 2>/dev/null; }
echo "env files:" $(ls .env .env.local .env.production .env.production.local 2>/dev/null)
for v in VITE_CONTACT_ENDPOINT; do
  n=$(envcat | grep -cE "^${v}=[\"']?[^\"'[:space:]]")
  printenv "$v" >/dev/null && s=" (also set in shell)" || s=""
  echo "$v: $n non-empty definition(s)$s"
done
```

If it has 0 definitions and is not set in the shell, warn: the contact form will answer every submission with "Message not sent: the contact form isn't configured yet" in production (see `src/components/ContactForm.jsx`; the endpoint is `contact-api/`, deployed on Vercel). Its value is a public URL, but print only the count. The Resend key must never be in any `.env` here: it lives in the Vercel project. Ask whether to continue. Do not offer to write the `.env` (the PreToolUse hook blocks it anyway). The user adds the values themselves.

## 4. Lint and build

Run lint first, on its own:

```bash
npm run lint > /tmp/deploy-lint.log 2>&1; echo "lint exit: $?"
```

If the exit code is not 0, **stop** and report the summary line and the top rules:

```bash
grep -E '✖ [0-9]+ problems' /tmp/deploy-lint.log
grep -oE '[a-z-]+/[a-z-]+$|no-[a-z-]+$' /tmp/deploy-lint.log | sort | uniq -c | sort -rn | head
```

The repo has about 96 known lint errors (see CLAUDE.md), so expect this until they are fixed. Do not add `eslint-disable` comments or loosen `eslint.config.js` to get past this step. Skip lint only if the user explicitly says so in this conversation, and note "lint skipped by user" in the final report.

Only after lint passes (or was explicitly skipped):

```bash
npm run build
```

If the build fails, **stop**.

## 5. Audit dist/

```bash
grep -oE '(src|href)="[^"]+"' dist/index.html     # every URL must start with /assets/
du -sh dist
find dist -type f -printf '%s\t%p\n' | sort -rn | head -10 | numfmt --field=1 --to=iec
```

Any `src`/`href` in `dist/index.html` that does not start with `/assets/` (absolute `https://` URLs excepted): **stop**; a `/portfolio/` prefix means `base` is stale. Expected today: `index-*.js`, `index-*.css`, `logo-*.svg` and the `vendor-react` / `vendor-motion` preloads, all under `/assets/`.

Secret scan. `VITE_CONTACT_ENDPOINT` is a public URL, inlined client-side by design. Anything else is a leak, a Resend key (`re_…`) above all:

```bash
grep -rhoE 'import\.meta\.env\.[A-Z0-9_]+' src | sort -u     # expect only VITE_CONTACT_ENDPOINT, VITE_GRAFANA_DASHBOARD_URL (+ BASE_URL)
grep -rcE '(re_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}|ghp_|gho_|github_pat_|sk_live_|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY)' dist | grep -v ':0$'
# values of any other VITE_* var defined in the env files: report only how many dist files contain them
envcat() { cat .env .env.local .env.production .env.production.local 2>/dev/null; }
for v in $(envcat | grep -oE '^VITE_[A-Z0-9_]+' | grep -v '^VITE_CONTACT_ENDPOINT$' | sort -u); do
  val=$(envcat | grep -E "^$v=" | tail -1 | cut -d= -f2- | tr -d "\"'")
  [ -n "$val" ] && echo "$v: $(grep -rlF -- "$val" dist | wc -l) file(s) in dist"
done
```

Any hit: **stop**. Report the file and variable or pattern name only, never the matched text.

## 6. Publish

Use `npx gh-pages -d dist`, not `npm run deploy`. `npm run deploy` triggers `predeploy` (lint + build again), which rebuilds `dist/` after it was audited and fails while lint is red. Calling gh-pages directly publishes exactly the `dist/` that passed steps 4 and 5. The lint gate was already enforced in step 4.

This is an outward-facing action. Right before running it, summarize the branch, commit (`git log -1 --oneline`), dist size and any warnings, then ask the user to confirm. Only then run:

```bash
npx gh-pages -d dist --nojekyll -r https://github.com/yel-hadr/yel-hadr.github.io.git -b main -m "Deploy yel-hadr/portfolio@$(git rev-parse --short HEAD)"
```

`--nojekyll` writes `.nojekyll` to the branch so GitHub Pages does not run Jekyll, which silently drops any file or folder whose name starts with `_` (Rollup can emit such chunk names).

If gh-pages fails with a stale cache error such as "branch already exists", run `npx gh-pages-clean` and retry once.

## 7. Pages setup (first time)

```bash
gh api repos/yel-hadr/yel-hadr.github.io/pages --jq '{status, html_url, build_type, source}'
```

- `404 Not Found`: Pages is not enabled. Tell the user to go to github.com/yel-hadr/yel-hadr.github.io → Settings → Pages → Build and deployment → Source: "Deploy from a branch" → Branch `main` / `/ (root)` → Save. Or offer to run the following, and ask before running it:
  `gh api -X POST repos/yel-hadr/yel-hadr.github.io/pages -f "source[branch]=main" -f "source[path]=/"`
- Enabled but `source.branch` is not `main` or `source.path` is not `/`: offer the fix and ask first:
  `gh api -X PUT repos/yel-hadr/yel-hadr.github.io/pages -f "source[branch]=main" -f "source[path]=/"`
- `build_type` of `workflow` means Pages deploys from GitHub Actions and ignores the `main` branch contents. Point this out and ask before switching it.

## 8. Verify live

Wait for the Pages build of the commit just pushed. It usually takes 1 to 2 minutes. `builds/latest` keeps returning the previous build until the new one is queued, so match on the target repo's `main` head SHA, not on status alone. Run this with a Bash `timeout` of 300000 (the default 120 s is too short):

```bash
sha=$(git ls-remote https://github.com/yel-hadr/yel-hadr.github.io.git refs/heads/main | cut -f1)
for i in $(seq 1 24); do
  b=$(gh api repos/yel-hadr/yel-hadr.github.io/pages/builds/latest --jq '.status + " " + .commit')
  echo "$b"
  case "$b" in "built $sha"|"errored $sha") break;; esac
  sleep 10
done
```

`errored`, or still not `built` after the loop: **stop** and report. Otherwise:

```bash
curl -sI https://yel-hadr.github.io/ | head -1                      # expect 200
curl -sI https://yel-hadr.github.io/planet/scene.glb | head -1         # expect 200
```

Then use the `playwright` MCP server at each viewport, 390x844 (mobile) and 1440x900 (desktop):
1. `mcp__playwright__browser_resize` to the viewport.
2. `mcp__playwright__browser_navigate` to `https://yel-hadr.github.io/`, then `mcp__playwright__browser_wait_for` about 5 seconds for the models to load.
3. `mcp__playwright__browser_take_screenshot` (`deploy-390.png` / `deploy-1440.png`).
4. `mcp__playwright__browser_console_messages` for errors, and `mcp__playwright__browser_network_requests` for failed requests.

404s on `.glb` files or `/assets/*` (including the lazy `vendor-three` / `Scene3D` chunks) almost always mean a base-path problem (step 2). Look at the screenshots: a blank hero, or the "3D scenes are turned off" notice, means the 3D layer did not load. Before blaming the deploy for a WebGL fallback, check the console for WebGL context-creation errors: headless Chromium sometimes has no GPU, which is an environment limit, not a site bug. The site uses a single WebGL context, so a "Too many active WebGL contexts" warning is a regression; report it.

## Report

End with a short report:
- Deployed commit, plus any warnings the user accepted (dirty tree, not on main, missing contact endpoint env, lint skipped).
- dist size and the 3 largest files.
- HTTP status of the site and both gltf files.
- Screenshot paths, plus console errors and failed requests per viewport (or "none").
