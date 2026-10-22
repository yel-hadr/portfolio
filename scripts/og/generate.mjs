// Social card generator: renders scripts/og/card.html in headless Chromium and writes
// public/og-image.png (1200x630, the Open Graph / Twitter image). Re-run it after changing the
// name, title, photo or theme colors:
//
//   node scripts/og/generate.mjs
//
// Playwright is not a project dependency. The script uses it from node_modules when present
// (`npm i --no-save playwright && npx playwright install chromium`), otherwise from the folder
// named by PLAYWRIGHT_DIR (any directory with node_modules/playwright):
//
//   PLAYWRIGHT_DIR=/path/to/dir node scripts/og/generate.mjs
//
// Name and title come from src/constans/index.js and src/locales/en/core.json, colors from the
// dark theme tokens in src/index.css, so the card follows the site.
import { createRequire } from 'node:module';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { encodePng8 } from './png8.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'public/og-image.png');
const SIZE = { width: 1200, height: 630 };
const DOMAIN = 'yel-hadr.github.io';
// Social networks recompress big images (and some reject > 1 MB); keep the card light
const MAX_BYTES = 300 * 1024;

const loadPlaywright = () => {
  const bases = [import.meta.url];
  if (process.env.PLAYWRIGHT_DIR) bases.push(resolve(process.env.PLAYWRIGHT_DIR, 'package.json'));
  for (const base of bases) {
    try {
      return createRequire(base)('playwright');
    } catch {
      // Try the next location
    }
  }
  throw new Error(
    'Playwright not found: install it (see the comment at the top) or set PLAYWRIGHT_DIR'
  );
};

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dataUrl = async (path, type) =>
  `data:${type};base64,${(await readFile(resolve(ROOT, path))).toString('base64')}`;

// The `:root` block of src/index.css is the dark theme, the site's default look
const darkTokens = async () => {
  const css = await readFile(resolve(ROOT, 'src/index.css'), 'utf8');
  const block = css.match(/:root\s*\{([^}]*)\}/)?.[1];
  if (!block) throw new Error('No :root block in src/index.css');
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^--(c|color)-[\w-]+:/.test(line))
    .join('\n');
};

const fonts = async () => {
  const faces = await Promise.all(
    [500, 600, 900].map(async (weight) => {
      const src = await dataUrl(
        `node_modules/@fontsource/poppins/files/poppins-latin-${weight}-normal.woff2`,
        'font/woff2'
      );
      return `@font-face { font-family: Poppins; font-weight: ${weight}; src: url(${src}) format('woff2'); }`;
    })
  );
  return faces.join('\n');
};

const main = async () => {
  const core = JSON.parse(await readFile(resolve(ROOT, 'src/locales/en/core.json'), 'utf8'));
  const constants = await readFile(resolve(ROOT, 'src/constans/index.js'), 'utf8');
  const name = constants.match(/name:\s*'([^']+)',\s*\n\s*alias:/)?.[1];
  if (!name) throw new Error('person.name not found in src/constans/index.js');
  // "Software Engineer | Cloud ..." breaks after the bar, not anywhere in the line
  const title = escapeHtml(core.person.title).replace(/\s*\|\s*/, ' |<br />');

  const template = await readFile(resolve(import.meta.dirname, 'card.html'), 'utf8');
  const values = {
    FONTS: await fonts(),
    TOKENS: await darkTokens(),
    NAME: escapeHtml(name),
    TITLE: title,
    DOMAIN,
    PHOTO: await dataUrl('src/assets/profile-640.webp', 'image/webp'),
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('body[data-ready="true"]');
    const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, ...SIZE } });
    // Decode the screenshot back to pixels in the browser, then write it as a 256-color PNG
    const pixels = await page.evaluate(
      async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const { data } = ctx.getImageData(0, 0, image.width, image.height);
        let binary = '';
        for (let i = 0; i < data.length; i += 0x8000) {
          binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      },
      `data:image/png;base64,${shot.toString('base64')}`
    );
    await writeFile(OUT, encodePng8(Buffer.from(pixels, 'base64'), SIZE.width, SIZE.height));
  } finally {
    await browser.close();
  }

  const { size } = await stat(OUT);
  console.log(`Wrote ${OUT} (${Math.round(size / 1024)} KB)`);
  if (size > MAX_BYTES) {
    console.warn(`Warning: over ${MAX_BYTES / 1024} KB; simplify the card or lower the line count`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
