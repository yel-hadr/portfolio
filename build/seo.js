// SEO and analytics for the static site (GitHub Pages serves files only, so everything a crawler
// or a link preview needs is written into the HTML at build time):
//   seo()                Vite plugin: social tags, JSON-LD and the analytics script for
//                        index.html and status/index.html; sitemap.xml and the profile image
//                        for the JSON-LD (build output, and served by the dev server)
//   headTags(opts)       -> <title>, description, canonical, hreflang, RSS, Open Graph, Twitter
//                        and JSON-LD tags for a generated page (the blog pages)
//   analyticsTags(env)   -> the Umami <script>, '' when VITE_UMAMI_WEBSITE_ID is not set
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';

export const SITE_URL = 'https://yel-hadr.github.io';
export const SITE_NAME = 'Youssef El Hadraoui';
export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
// RSS feeds (fixed URLs, written by the blog plugin)
export const FEEDS = { en: '/blog/rss.xml', fr: '/fr/blog/rss.xml' };
// Social card made by scripts/og/generate.mjs (public/og-image.png)
export const OG_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  alt: {
    en: 'Youssef El Hadraoui, Software Engineer in cloud infrastructure and DevOps: his portrait and yel-hadr.github.io',
    fr: 'Youssef El Hadraoui, ingénieur logiciel en infrastructure cloud et DevOps : son portrait et yel-hadr.github.io',
  },
};
// src/assets/profile-640.webp is content-hashed by Vite; the plugin also writes it here so the
// JSON-LD has a URL that never changes
const PROFILE_IMAGE = { path: '/profile.webp', source: 'src/assets/profile-640.webp' };

const LOCALES = { en: 'en_US', fr: 'fr_FR' };
const FEED_TITLES = {
  en: `Blog – ${SITE_NAME} (English)`,
  fr: `Blog – ${SITE_NAME} (français)`,
};
const ROBOTS = 'index, follow, max-image-preview:large';
const UMAMI_SCRIPT = 'https://cloud.umami.is/script.js';
// The tracker only runs on this hostname, so dev servers and previews are never counted
const UMAMI_DOMAINS = 'yel-hadr.github.io';

export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** '/blog/x/' or a full URL -> absolute URL on the site. */
export const absoluteUrl = (pathOrUrl = '/') =>
  /^https?:\/\//.test(pathOrUrl)
    ? pathOrUrl
    : `${SITE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

// JSON inside <script>: "<" escaped so a value can never close the element
const jsonScript = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const meta = (attribute, key, content) =>
  `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;

/**
 * Alternates as `{ en: '/blog/x/', fr: '/fr/blog/x/' }` or `[{ hreflang|lang, href|path }]`
 * -> [{ hreflang, href }] with absolute URLs and an x-default (English) when English exists.
 */
const normalizeAlternates = (alternates) => {
  if (!alternates) return [];
  const list = Array.isArray(alternates)
    ? alternates.map((entry) => ({
        hreflang: entry.hreflang ?? entry.lang,
        href: entry.href ?? entry.path ?? entry.url,
      }))
    : Object.entries(alternates).map(([hreflang, href]) => ({ hreflang, href }));
  const valid = list
    .filter((entry) => entry.hreflang && entry.href)
    .map((entry) => ({ ...entry, href: absoluteUrl(entry.href) }));
  const english = valid.find((entry) => entry.hreflang === 'en');
  if (english && !valid.some((entry) => entry.hreflang === 'x-default')) {
    valid.push({ hreflang: 'x-default', href: english.href });
  }
  return valid;
};

/**
 * Every head tag except <title> and the description: canonical, robots, hreflang alternates,
 * RSS links, Open Graph (article fields for posts), Twitter card and JSON-LD.
 */
export const socialTags = ({
  title = SITE_NAME,
  description = '',
  path = '/',
  lang = 'en',
  type = 'website',
  image,
  imageAlt,
  imageWidth,
  imageHeight,
  alternates,
  publishedTime,
  modifiedTime,
  tags = [],
  jsonLd,
  robots = ROBOTS,
}) => {
  const url = absoluteUrl(path);
  const links = normalizeAlternates(alternates);
  // Without explicit alternates the page itself serves both languages (the portfolio)
  const otherLangs = (
    links.length ? links.map((entry) => entry.hreflang) : Object.keys(LOCALES)
  ).filter((code) => code !== lang && LOCALES[code]);
  const custom = Boolean(image);
  const imageUrl = absoluteUrl(image ?? OG_IMAGE.path);
  const alt = imageAlt ?? (custom ? title : (OG_IMAGE.alt[lang] ?? OG_IMAGE.alt.en));
  const width = imageWidth ?? (custom ? undefined : OG_IMAGE.width);
  const height = imageHeight ?? (custom ? undefined : OG_IMAGE.height);
  // The visitor's language first
  const feeds = Object.keys(FEEDS).sort((a, b) => (a === lang ? -1 : b === lang ? 1 : 0));

  return [
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    meta('name', 'robots', robots),
    meta('name', 'author', SITE_NAME),
    ...links.map(
      ({ hreflang, href }) =>
        `<link rel="alternate" hreflang="${escapeHtml(hreflang)}" href="${escapeHtml(href)}" />`
    ),
    ...feeds.map(
      (code) =>
        // No hreflang here: crawlers read hreflang on any rel=alternate link, and a feed is not
        // the page in another language (that would clash with the page's own alternates)
        `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(FEED_TITLES[code])}" href="${absoluteUrl(FEEDS[code])}" />`
    ),
    meta('property', 'og:type', type),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:url', url),
    meta('property', 'og:image', imageUrl),
    ...(width && height
      ? [meta('property', 'og:image:width', width), meta('property', 'og:image:height', height)]
      : []),
    meta('property', 'og:image:alt', alt),
    meta('property', 'og:locale', LOCALES[lang] ?? LOCALES.en),
    ...otherLangs.map((code) => meta('property', 'og:locale:alternate', LOCALES[code])),
    ...(type === 'article'
      ? [
          ...(publishedTime ? [meta('property', 'article:published_time', publishedTime)] : []),
          ...(modifiedTime ? [meta('property', 'article:modified_time', modifiedTime)] : []),
          meta('property', 'article:author', `${SITE_URL}/`),
          ...tags.map((tag) => meta('property', 'article:tag', tag)),
        ]
      : []),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', imageUrl),
    meta('name', 'twitter:image:alt', alt),
    ...(jsonLd ? [jsonLd].flat().map(jsonScript) : []),
  ].join('\n');
};

/** Full head block for a generated page (see socialTags for the fields). */
export const headTags = (options = {}) =>
  [
    `<title>${escapeHtml(options.title ?? SITE_NAME)}</title>`,
    meta('name', 'description', options.description ?? ''),
    socialTags(options),
  ].join('\n');

// The home page's Person, by reference (with a name, since a post page does not define it)
const AUTHOR = { '@type': 'Person', '@id': PERSON_ID, name: SITE_NAME, url: `${SITE_URL}/` };

/** BlogPosting JSON-LD for a post page, linked to the Person and WebSite of the home page. */
export const blogPostingJsonLd = ({
  title,
  description,
  path,
  lang = 'en',
  publishedTime,
  modifiedTime,
  tags = [],
  image,
}) => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description,
  url: absoluteUrl(path),
  mainEntityOfPage: absoluteUrl(path),
  inLanguage: lang,
  ...(publishedTime ? { datePublished: publishedTime } : {}),
  ...(modifiedTime || publishedTime ? { dateModified: modifiedTime ?? publishedTime } : {}),
  ...(tags.length ? { keywords: tags.join(', ') } : {}),
  image: absoluteUrl(image ?? OG_IMAGE.path),
  author: AUTHOR,
  publisher: AUTHOR,
  isPartOf: { '@id': WEBSITE_ID },
});

/**
 * Umami (cookieless, no consent banner needed) when VITE_UMAMI_WEBSITE_ID is set. `env` holds
 * the VITE_ variables (loadEnv). A malformed value turns analytics off with a warning instead
 * of failing the deploy.
 */
export const analyticsTags = (env = {}) => {
  const id = env.VITE_UMAMI_WEBSITE_ID?.trim();
  if (!id) return '';
  const src = env.VITE_UMAMI_SCRIPT_URL?.trim() || UMAMI_SCRIPT;
  let https = false;
  try {
    https = new URL(src).protocol === 'https:';
  } catch {
    // Not a URL: reported below
  }
  if (!/^[\w-]+$/.test(id) || !https) {
    console.warn('[seo] Analytics off: VITE_UMAMI_WEBSITE_ID or VITE_UMAMI_SCRIPT_URL is invalid');
    return '';
  }
  return `<script defer src="${escapeHtml(src)}" data-website-id="${escapeHtml(id)}" data-domains="${UMAMI_DOMAINS}" data-do-not-track="true"></script>`;
};

const readJson = async (root, path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

// src/constans/index.js imports images, so Node cannot import it; read the few plain values the
// JSON-LD needs from its source instead
const readConstants = async (root) => {
  const source = await readFile(resolve(root, 'src/constans/index.js'), 'utf8');
  const block = (name) =>
    source.match(new RegExp(`const ${name} = [[{]([\\s\\S]*?)\\n[\\]}];`))?.[1];
  const person = Object.fromEntries(
    [...(block('person') ?? '').matchAll(/^\s*(\w+): '([^']*)',/gm)].map(([, key, value]) => [
      key,
      value,
    ])
  );
  const technologies = [...(block('technologies') ?? '').matchAll(/name: '([^']+)'/g)].map(
    ([, name]) => name
  );
  if (!person.name || !technologies.length) {
    console.warn('[seo] Could not read person/technologies from src/constans/index.js');
  }
  return { person, technologies };
};

/** ProfilePage + WebSite graph for the home page; every fact comes from the site's content. */
const homeJsonLd = async (root, { title, description }) => {
  const core = await readJson(root, 'src/locales/en/core.json');
  const { person, technologies } = await readConstants(root);
  const name = person.name ?? SITE_NAME;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: `${SITE_URL}/`,
        name,
        description,
        inLanguage: ['en', 'fr'],
        author: { '@id': PERSON_ID },
      },
      {
        '@type': 'ProfilePage',
        '@id': `${SITE_URL}/#profilepage`,
        url: `${SITE_URL}/`,
        name: title,
        description,
        inLanguage: ['en', 'fr'],
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: {
          '@type': 'Person',
          '@id': PERSON_ID,
          name,
          ...(person.alias ? { alternateName: person.alias } : {}),
          jobTitle: core.person.title,
          description: core.person.summary,
          url: `${SITE_URL}/`,
          image: absoluteUrl(PROFILE_IMAGE.path),
          ...(person.email ? { email: `mailto:${person.email}` } : {}),
          sameAs: [person.github, person.linkedin].filter(Boolean),
          // Education section (education.items): the 1337 Common Core and 42 Paris
          alumniOf: [
            { '@type': 'EducationalOrganization', name: '1337 Coding School (UM6P)' },
            { '@type': 'EducationalOrganization', name: '42 Paris' },
          ],
          // Tech stack and the "What I do" areas of the About section
          knowsAbout: [...technologies, ...Object.values(core.about.services)],
          // Experience section: the current role
          worksFor: { '@type': 'Organization', name: 'Legaliox' },
        },
      },
    ],
  };
};

// The two Vite pages: path -> how to describe it. Generated blog pages call headTags() instead.
const PAGES = {
  '/': { jsonLd: homeJsonLd },
  '/status/': {},
};

const pageText = (html, pattern) => {
  const match = html.match(pattern);
  return match
    ? match[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim()
    : '';
};

const isoDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
};

// posts.js is filled by the blog feature and may change between builds: import a fresh copy
const loadPosts = async (root) => {
  try {
    const url = pathToFileURL(resolve(root, 'src/constans/posts.js')).href;
    const { posts = [] } = await import(`${url}?t=${Date.now()}`);
    return Array.isArray(posts) ? posts.filter((post) => post?.slug && !post.draft) : [];
  } catch (error) {
    console.warn(`[seo] No posts in the sitemap: ${error.message}`);
    return [];
  }
};

const postLangs = (post) => {
  const langs = post.langs ?? post.languages ?? Object.keys(LOCALES);
  return langs.filter((code) => LOCALES[code]);
};
const blogPath = (lang, slug = '') =>
  `${lang === 'en' ? '' : `/${lang}`}/blog/${slug ? `${slug}/` : ''}`;

/** sitemap.xml: the pages, both blog indexes and every post in each of its languages. */
export const sitemapXml = (posts, buildDate = new Date()) => {
  const today = buildDate.toISOString().slice(0, 10);
  const postDate = (post) => isoDate(post.updated ?? post.modified ?? post.date) ?? today;
  const latest = posts.map(postDate).sort().at(-1) ?? today;
  const langs = Object.keys(LOCALES);
  const group = (paths) => Object.fromEntries(paths);

  const entries = [
    { path: '/', lastmod: today },
    { path: '/status/', lastmod: today },
    ...langs.map((lang) => ({
      path: blogPath(lang),
      lastmod: latest,
      alternates: group(langs.map((code) => [code, blogPath(code)])),
    })),
    ...posts.flatMap((post) => {
      const available = postLangs(post);
      const alternates =
        available.length > 1
          ? group(available.map((code) => [code, blogPath(code, post.slug)]))
          : undefined;
      return available.map((lang) => ({
        path: blogPath(lang, post.slug),
        lastmod: postDate(post),
        alternates,
      }));
    }),
  ];

  const urls = entries.map(({ path, lastmod, alternates }) =>
    [
      '  <url>',
      `    <loc>${escapeHtml(absoluteUrl(path))}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      ...normalizeAlternates(alternates).map(
        ({ hreflang, href }) =>
          `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(href)}" />`
      ),
      '  </url>',
    ].join('\n')
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
};

export default function seo() {
  let root = process.cwd();
  let env = {};

  return {
    name: 'portfolio-seo',

    configResolved(config) {
      root = config.root;
      // VITE_ variables from .env files and from the process (CI passes repository variables)
      env = loadEnv(config.mode, config.envDir ?? config.root, 'VITE_');
    },

    // Static tags for the two Vite pages: crawlers and link previews do not run JavaScript.
    // Title and description stay in the HTML files (I18nProvider swaps them per language).
    async transformIndexHtml(html, ctx) {
      const path = (ctx.path ?? '/').replace(/index\.html$/, '');
      const page = PAGES[path];
      if (!page) return html;
      const title = pageText(html, /<title>([^<]*)<\/title>/);
      const description = pageText(html, /<meta\s+name="description"\s+content="([^"]*)"/);
      const jsonLd = page.jsonLd ? await page.jsonLd(root, { title, description }) : undefined;
      const tags = [socialTags({ title, description, path, jsonLd }), analyticsTags(env)]
        .filter(Boolean)
        .join('\n');
      return html.replace(/\n?[ \t]*<\/head>/, `\n${tags.replace(/^/gm, '    ')}\n  </head>`);
    },

    // Dev server: the same sitemap and profile image as the build
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/sitemap.xml') {
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.end(sitemapXml(await loadPosts(root)));
        } else if (url === PROFILE_IMAGE.path) {
          res.setHeader('Content-Type', 'image/webp');
          res.end(await readFile(resolve(root, PROFILE_IMAGE.source)));
        } else {
          next();
        }
      });
    },

    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemapXml(await loadPosts(root)),
      });
      this.emitFile({
        type: 'asset',
        fileName: PROFILE_IMAGE.path.slice(1),
        source: await readFile(resolve(root, PROFILE_IMAGE.source)),
      });
    },
  };
}
