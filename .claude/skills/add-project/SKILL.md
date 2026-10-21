---
name: add-project
description: Add a portfolio content entry (project, experience or tech) end to end. Asks for missing fields first, copies the image into src/assets/, src/assets/tech/ or src/assets/company/ without overwriting, adds its import and named export to src/assets/index.js, appends the matching entry to src/constans/index.js, then lints and builds to verify. Manual use only.
argument-hint: "<project|experience|tech> <details: name, description, tags, image path, link, dates, points...>"
disable-model-invocation: true
---

# Add a portfolio entry

Request: $ARGUMENTS

Content is data-driven: image file → `src/assets/index.js` export → entry in `src/constans/index.js`. The section components only map over the arrays. Follow the steps in order. Do not skip verification.

## Ground rules

- `src/constans/` is spelled that way on purpose. Never rename it.
- JavaScript only. No `.ts`/`.tsx`, no type annotations.
- Never edit components (`src/components/**`) unless the user asks. If a field will not render, say so and ask.
- Never overwrite an existing file. Never edit `.env*`, `package-lock.json` or `dist/`.
- The PostToolUse hook lints every `.js`/`.jsx` you edit. Both data files lint clean today, so any error it reports comes from your edit. Fix it before continuing.
- Run every command from the repo root `/home/youssefelhadraoui/Desktop/portfolio`. All paths below are relative to it.

## 1. Parse the request and fill the gaps

Work out the entry type: `project`, `experience` or `tech`. Then confirm you have every required field. **Ask the user for anything missing before editing any file.** Do not invent descriptions, dates, links or points.

| Type | Required | Optional |
|---|---|---|
| project | name, description, 1+ tags | image path (cards render text-only without one), `source_code_link` (full `https://` URL; omit while the repo is private), tag colors |
| experience | title, date (match the existing `"Month YYYY - Month YYYY"` style), 1+ points | company_name, logo image path, iconBg (default `"#383E56"`) |
| tech | name, icon image path | — |

Check that the source image exists (`ls -l <path>`). Tech icons are applied as a decal on a sphere (`canvas/Ball.jsx`), so they should be small square PNGs with a transparent background, like the existing ones in `src/assets/tech/`. Then check for a duplicate (`Tech.jsx` uses `tech.name` as the React key, so a duplicate tech name also breaks rendering): if an entry with the same `name`/`title` already exists in `src/constans/index.js`, stop and ask.

## 2. Read the current shapes (do not work from memory)

Read these files so field names and style come from the code:

- `src/components/Works.jsx`: `ProjectCard` destructures the project fields. `tag.color` is used as a class name.
- `src/components/Experience.jsx`: `ExperienceCard` reads `experience.*` fields.
- `src/components/Tech.jsx`: maps `technologies` and renders a `SceneView` + `Ball` per entry, with the name shown under it.
- `src/assets/index.js` and `src/constans/index.js`: current imports, exports and arrays.
- `grep -n "text-gradient {" src/index.css`: valid tag colors. Today these are `blue-text-gradient`, `green-text-gradient`, `pink-text-gradient` and `orange-text-gradient`. Existing projects only use blue, green and pink.

Known gap (verify again before you rely on it): `Experience.jsx` renders an empty `<div>` as the timeline icon and ignores `experience.icon`. A logo you add will not show up until the component changes. Tell the user, and touch the component only if they ask.

## 3. Copy the image

Target folder:

- project screenshot → `src/assets/`
- tech icon → `src/assets/tech/`
- company logo (experience) → `src/assets/company/`

Pick an identifier that is also the file basename, as the existing assets do (`ft_irc` → `./ft_irc.webp`, `cub3D_42` → `./cub3D_42.webp`). It must be a valid JS identifier: letters, digits and `_`, not starting with a digit, no `-`, spaces or dots, and not a reserved word. Assets are stored as WebP at their display size (step below); SVGs stay SVG.

Check for collisions before copying, with both checks:

```bash
mkdir -p src/assets/company   # only exists once a logo has been added
ls src/assets src/assets/tech src/assets/company
grep -nw "<identifier>" src/assets/index.js src/constans/index.js
```

If the name is taken, choose another one (for example append `_project` or `_logo`) and tell the user.

Every raster asset in the repo is WebP at the size it is displayed (Phase 3 cut `src/assets` from 12 MB to 428 KB), so convert while copying; never commit the original PNG/JPEG. Write straight into the target folder after checking the path does not exist:

```bash
# project screenshot: cards show a centred 16:9 crop, so store exactly that
magick "<source>" -resize '800x450^' -gravity center -extent 800x450 -quality 80 -define webp:method=6 src/assets/<identifier>.webp
# tech icon (decal texture on the ball): square, transparent background
magick "<source>" -resize '256x256>' -quality 85 -define webp:method=6 src/assets/tech/<identifier>.webp
# company logo
magick "<source>" -resize '128x128>' -quality 85 -define webp:method=6 src/assets/company/<identifier>.webp
ls -l src/assets/<folder>/<identifier>.webp && identify src/assets/<folder>/<identifier>.webp
```

Tell the user the source and output sizes. If the result is still above about 150 KB, say so. If the source is an SVG, copy it as-is with `cp -n`.

## 4. Register the asset in `src/assets/index.js`

Add both lines in the existing style (double quotes, semicolons, relative path):

1. An `import <identifier> from "./<folder>/<identifier>.<ext>";` placed with its group: core assets at the top, then `./tech/*`, `./company/*`, then project screenshots.
2. `<identifier>,` inside the `export { ... }` block.

Both are required. A missing export becomes `undefined` at runtime, and the build will not catch it.

## 5. Add the entry to `src/constans/index.js`

1. Add `<identifier>,` to the `import { ... } from "../assets";` list at the top (4-space indent, like the other names).
2. Append the entry to the end of the right array (`technologies`, `experiences` or `projects`). The whole file body is offset by two spaces: array entries start at 4 spaces, fields at 6. Use double quotes and trailing commas. **If the current last element ends in `}` without a comma, add the comma**, or the file will not parse. Today the last `experiences` element has no trailing comma. Shapes, shown without the file's offset:

```js
// projects
{
  name: "...",
  description: "...",
  tags: [
    { name: "React", color: "blue-text-gradient" },
    { name: "Django", color: "green-text-gradient" },
  ],
  image: <identifier>,
  source_code_link: "https://github.com/...",
},

// experiences
{
  title: "...",
  company_name: "...",          // only if given
  icon: <identifier>,           // only if a logo was given
  iconBg: "#383E56",
  date: "Month YYYY - Month YYYY",
  points: ["...", "..."],
},

// technologies
{
  name: "...",
  icon: <identifier>,
},
```

Tags: rotate through the gradient classes the way existing projects do (first tag blue, then pink or green). Do not create new CSS classes.

**Tech entries and 3D.** Each `technologies` entry renders one `Ball` through a `SceneView` into the single shared Canvas (still one WebGL context, so no context budget applies). Each ball is another view drawn per frame, though, so if the list grows past about 15 icons, mention the extra render cost to the user.

## 6. Verify

```bash
npx eslint src/assets/index.js src/constans/index.js
npm run build
```

- ESLint: both files were clean before the edit, so any error now is new and must be fixed. Ignore pre-existing errors in other files. Do not run `npm run lint` as the pass/fail check, because it fails repo-wide today.
- Build: it must succeed. A failing import path or bad identifier shows up here.

Optional visual check, if the dev server starts:

1. Start `npm run dev` with the Bash tool's `run_in_background`, and read the port from its output (default `http://localhost:5173/portfolio/`; Vite moves to the next port if 5173 is busy; the `/portfolio/` base path is required).
2. With the Playwright MCP (`mcp__playwright__browser_*`), `browser_navigate` to the URL, then `browser_resize` to 390×844 and scroll to the section with `browser_evaluate` and the function `() => document.getElementById('works').scrollIntoView()` (section ids from `SectionWrapper`: `works`, `experience`, `tech`). Sections animate in only once they are in view, so wait about 2 seconds (`browser_wait_for` with `time: 2`), then `browser_take_screenshot`.
3. Repeat at 1440×900.
4. Check `browser_console_messages` for errors (404 on the image, WebGL context lost).
5. Stop the dev server when done.

## 7. Report

Reply with:

- The image file created, with source and output sizes (and a note if the WebP is still above about 150 KB).
- Each edit with `file:line` references: the import and export lines in `src/assets/index.js`, and the import line and new entry in `src/constans/index.js` (use `grep -n <identifier>` to get the line numbers).
- ESLint and build results, plus screenshots if you took them.
- Open issues: unrendered fields (experience `icon`), renames made to avoid a collision.

Do not commit. Leave that to the user.
