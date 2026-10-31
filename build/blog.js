// Blog: Markdown posts in content/blog/<slug>/<lang>.md -> static pages and RSS feeds.
//   Build: /blog/index.html, /blog/<slug>/index.html, the same under /fr/,
//          /blog/rss.xml + /fr/blog/rss.xml (GitHub Pages serves <dir>/index.html for <dir>/)
//          and the site-wide /404.html (GitHub Pages serves it for any unknown path).
//   Dev:   the same URLs, rendered on each request by a middleware (unknown /blog/ paths and
//          /404.html get the 404 page).
//   Site:  `virtual:blog-posts` gives the home page and the terminal each post's title and
//          summary (from the front matter) without shipping the Markdown bodies.
// The pages are plain HTML plus a small client entry (src/blog/entry.js: CSS, fonts, theme
// toggle, copy buttons); they work without JavaScript.
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Marked } from 'marked';
import { loadEnv } from 'vite';

import { SITE_URL, analyticsTags, headTags } from './seo.js';

const LANGS = ['en', 'fr'];
const LANG_NAMES = { en: ['EN', 'English'], fr: ['FR', 'Français'] };
const DATE_LOCALES = { en: 'en-GB', fr: 'fr-FR' };
const VIRTUAL_ID = 'virtual:blog-posts';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const ENTRY = 'src/blog/entry.js';
const POSTS_FILE = 'src/constans/posts.js';
const CONTENT_DIR = 'content/blog';
// Tag chip colors, cycled per post as on the home page (AA on the glass card in both themes)
const TAG_COLORS = ['text-info', 'text-success', 'text-primary-400'];
// Words per minute for the reading time
const WPM = 200;

// ---------------------------------------------------------------------------------------------
// Helpers

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Same entities, which are all valid in XML too
const escapeXml = escapeHtml;

// '{name}' placeholders -> values (values are inserted as given: escape them first if needed)
const fill = (text, vars = {}) =>
  text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));

const indexPath = (lang) => `${lang === 'en' ? '' : `/${lang}`}/blog/`;
const postPath = (lang, slug) => `${indexPath(lang)}${slug}/`;
const feedPath = (lang) => `${indexPath(lang)}rss.xml`;

// Newest first; Array.prototype.sort is stable, so posts with the same date keep their order
const byDate = (list) => [...list].sort((a, b) => b.date.localeCompare(a.date));

const formatDate = (date, lang) =>
  new Intl.DateTimeFormat(DATE_LOCALES[lang], { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`)
  );

// RFC 822 date for RSS (toUTCString gives "Wed, 21 Oct 2026 00:00:00 GMT")
const rfc822 = (date) => new Date(`${date}T00:00:00Z`).toUTCString();

/**
 * Tiny front matter parser: a leading `---` block of `key: value` lines (values may be quoted).
 * Enough for the title, summary and their short SEO forms; no nesting, lists or multi-line values.
 */
export const parseFrontMatter = (source) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) return { data: {}, body: source };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (field) data[field[1]] = field[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return { data, body: source.slice(match[0].length) };
};

// Lowercase ASCII id for heading anchors ("Why it happens" -> "why-it-happens")
const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// ---------------------------------------------------------------------------------------------
// Code blocks: comments are dimmed, the one bit of highlighting done by hand

const COMMENT_MARKERS = {
  ini: [';', '#'],
  yaml: ['#'],
  shell: ['#'],
  bash: ['#'],
  sh: ['#'],
  hcl: ['#', '//'],
  python: ['#'],
};

// Index where a line comment starts, or -1. A marker counts at the start of the line or after
// whitespace, and never inside a quoted string (so "#" in a value stays code).
const commentStart = (line, markers) => {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (
      (i === 0 || /\s/.test(line[i - 1])) &&
      markers.some((marker) => line.startsWith(marker, i))
    ) {
      return i;
    }
  }
  return -1;
};

const highlight = (code, language) => {
  const markers = COMMENT_MARKERS[language] ?? [];
  return code
    .split('\n')
    .map((line) => {
      const at = markers.length ? commentStart(line, markers) : -1;
      if (at < 0) return escapeHtml(line);
      return `${escapeHtml(line.slice(0, at))}<span class="tok-comment">${escapeHtml(line.slice(at))}</span>`;
    })
    .join('\n');
};

/** Markdown -> HTML with the blog's code blocks, heading anchors and scrollable tables. */
const renderMarkdown = (markdown, strings) => {
  let codeCount = 0;
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        // h1 is the page title; Markdown headings start at h2
        const level = Math.min(Math.max(depth, 2), 6);
        return `<h${level} id="${slugify(html)}">${html}</h${level}>\n`;
      },
      code({ text, lang }) {
        codeCount += 1;
        const language = (lang ?? '').trim().split(/\s+/)[0].toLowerCase() || 'text';
        const label = fill(strings.codeLabel, { n: codeCount, language });
        // tabindex: long lines scroll inside the block, and keyboard users can scroll it too.
        // The copy button and its status message are added by src/blog/entry.js.
        return (
          `<div class="code-block" data-code="${codeCount}">` +
          `<div class="code-head"><span class="code-lang">${escapeHtml(language)}</span></div>` +
          `<pre tabindex="0" role="region" aria-label="${escapeHtml(label)}">` +
          `<code class="language-${escapeHtml(language)}">${highlight(text.replace(/\n$/, ''), language)}</code>` +
          `</pre></div>\n`
        );
      },
      table(token) {
        // Default rendering, inside a wrapper that scrolls on narrow screens
        return `<div class="table-wrap">${this.constructor.prototype.table.call(this, token)}</div>\n`;
      },
    },
  });
  return marked.parse(markdown);
};

const countWords = (markdown) => (markdown.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

// ---------------------------------------------------------------------------------------------
// Data

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// Strings of the generated pages. Build-time only: a separate file from blog.json (which the
// home page imports), so they never reach the site's JavaScript.
const PAGE_STRINGS = 'blog-page.json';

/** Page strings per language (src/locales/<lang>/blog-page.json). */
const loadStrings = (root) =>
  Object.fromEntries(
    LANGS.map((lang) => [lang, readJson(resolve(root, `src/locales/${lang}/${PAGE_STRINGS}`))])
  );

// posts.js changes while the dev server runs: import a fresh copy whenever the file changes
const loadIndex = async (root) => {
  const file = resolve(root, POSTS_FILE);
  const version = statSync(file).mtimeMs;
  const { posts } = await import(`${pathToFileURL(file).href}?v=${version}`);
  return byDate(posts);
};

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;

const readPostFile = (root, slug, lang) => {
  const file = resolve(root, CONTENT_DIR, slug, `${lang}.md`);
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`[blog] Missing ${CONTENT_DIR}/${slug}/${lang}.md (listed in ${POSTS_FILE})`);
  }
  const { data, body } = parseFrontMatter(source);
  if (!data.title || !data.summary) {
    throw new Error(`[blog] ${CONTENT_DIR}/${slug}/${lang}.md needs a title and a summary`);
  }
  // Search engines cut a title past about 60 characters and a description past about 160: the
  // page's <title> and meta description take the short forms (`seoTitle`, optional, and
  // `description`, falling back to the title and summary), and the build stops on one too long
  const seo = { title: data.seoTitle || data.title, description: data.description || data.summary };
  const where = `${CONTENT_DIR}/${slug}/${lang}.md`;
  if (seo.title.length > SEO_TITLE_MAX) {
    throw new Error(`[blog] ${where}: title over ${SEO_TITLE_MAX} characters, add a seoTitle`);
  }
  if (seo.description.length > SEO_DESCRIPTION_MAX) {
    throw new Error(
      `[blog] ${where}: description over ${SEO_DESCRIPTION_MAX} characters, shorten it`
    );
  }
  return { title: data.title, summary: data.summary, seo, body };
};

/** Every post with its front matter in both languages, newest first. */
const loadPosts = async (root) =>
  (await loadIndex(root)).map((post) => ({
    ...post,
    langs: Object.fromEntries(LANGS.map((lang) => [lang, readPostFile(root, post.slug, lang)])),
  }));

// ---------------------------------------------------------------------------------------------
// Page template

// Same as the inline script in index.html, theme only: the URL decides the language here.
// Runs before the first paint, so the page never flashes the wrong theme.
const THEME_SCRIPT = `<script>
  (function () {
    var root = document.documentElement;
    var theme;
    try {
      theme = localStorage.getItem('theme');
    } catch (e) {}
    // Dark is the site's default look; light only when the visitor picked it
    if (theme !== 'light') theme = 'dark';
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content =
      theme === 'light' ? '#faf7f2' : '#0b0e14';
    document.querySelector('meta[name="color-scheme"]').content = theme;
  })();
</script>`;

const ICONS = {
  rss: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11a8 8 0 0 1 8 8M5 4a15 15 0 0 1 15 15"/><circle cx="6" cy="18" r="1.5" fill="currentColor"/></svg>',
  sun: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="theme-icon-sun h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>',
  moon: '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="theme-icon-moon h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  arrowLeft:
    '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  arrowRight:
    '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

const tagList = (tags, label) =>
  `<ul class="flex flex-wrap gap-2" aria-label="${escapeHtml(label)}">${tags
    .map((tag, i) => `<li class="tag ${TAG_COLORS[i % TAG_COLORS.length]}">${escapeHtml(tag)}</li>`)
    .join('')}</ul>`;

const postMeta = (post, lang, s) => {
  const minutes = Math.max(1, Math.round(countWords(post.langs[lang].body) / WPM));
  return `<p class="post-meta"><span class="sr-only">${escapeHtml(s.published)} </span><time datetime="${post.date}">${formatDate(post.date, lang)}</time><span aria-hidden="true">·</span><span>${escapeHtml(fill(s.readingTime, { minutes }))}</span></p>`;
};

/**
 * One full HTML page. `alternatePaths`: the same page in each language ({ en, fr }), used for
 * the language switch (and hreflang through headTags).
 */
const renderPage = (ctx, { lang, head, alternatePaths, current, main }) => {
  const s = ctx.strings[lang];
  const href = ctx.href;
  const themeLabel = s.themeToLight;
  const languageSwitch = LANGS.map((code) => {
    const [short, full] = LANG_NAMES[code];
    const active = code === lang;
    return `<a href="${href(alternatePaths[code])}" lang="${code}" hreflang="${code}" data-lang-link="${code}" class="lang-option${active ? ' is-active' : ''}"${active ? ' aria-current="true"' : ''}><span aria-hidden="true">${short}</span><span class="sr-only">${full}</span></a>`;
  }).join('');
  // Strings for the client entry (copy buttons, theme toggle labels)
  const clientStrings = JSON.stringify({
    copy: s.copy,
    copySr: s.copySr,
    copied: s.copied,
    copyFailed: s.copyFailed,
    themeToLight: s.themeToLight,
    themeToDark: s.themeToDark,
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${lang}" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0b0e14" />
    <meta name="color-scheme" content="dark" />
    <link rel="icon" type="image/svg+xml" href="${href('/logo.svg')}" />
    <link rel="apple-touch-icon" href="${href('/apple-touch-icon.png')}" />
    ${THEME_SCRIPT}
    ${head}
    ${ctx.assets.css.map((file) => `<link rel="stylesheet" href="${file}" />`).join('\n    ')}
    ${ctx.analytics}
  </head>
  <body class="flex min-h-screen flex-col">
    <div class="blog-backdrop" aria-hidden="true"></div>
    <a href="#main" class="skip-link">${escapeHtml(s.skipLink)}</a>
    <header class="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur-md">
      <div class="blog-container flex items-center justify-between gap-2 py-3">
        <a href="${href('/')}" class="flex shrink-0 items-center gap-2 rounded-xl" aria-label="${escapeHtml(s.home)}">
          <img src="${href('/logo.svg')}" alt="" width="36" height="36" class="h-9 w-9 object-contain" />
          <span aria-hidden="true" class="hidden text-lg font-bold text-foreground sm:inline">${escapeHtml(s.author)}</span>
        </a>
        <div class="flex items-center gap-1 sm:gap-2">
          <nav aria-label="${escapeHtml(s.nav)}">
            <ul class="flex items-center gap-1">
              <li><a href="${href(indexPath(lang))}" class="header-link"${current === 'index' ? ' aria-current="page"' : ''}>${escapeHtml(s.blog)}</a></li>
              <li><a href="${href(feedPath(lang))}" class="header-link" type="application/rss+xml">${ICONS.rss}<span>${escapeHtml(s.rss)}</span></a></li>
            </ul>
          </nav>
          <div role="group" aria-label="${escapeHtml(s.language)}" class="lang-switch">${languageSwitch}</div>
          <button type="button" class="icon-btn" data-theme-toggle hidden aria-label="${escapeHtml(themeLabel)}" title="${escapeHtml(themeLabel)}">${ICONS.sun}${ICONS.moon}</button>
        </div>
      </div>
    </header>
    <main id="main" tabindex="-1" class="blog-container flex-1 py-12 sm:py-16">
${main}
    </main>
    <footer class="border-t border-line bg-background/80 backdrop-blur-md">
      <div class="blog-container flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-8 text-sm text-foreground-muted">
        <p>${escapeHtml(fill(s.rights, { year: ctx.year }))}</p>
        <ul class="flex flex-wrap gap-x-6 gap-y-2">
          <li><a href="${href('/')}" class="footer-link">${escapeHtml(s.portfolio)}</a></li>
          <li><a href="${href(indexPath(lang))}" class="footer-link">${escapeHtml(s.allPosts)}</a></li>
          <li><a href="${href(feedPath(lang))}" class="footer-link" type="application/rss+xml">${escapeHtml(s.rss)}</a></li>
        </ul>
      </div>
    </footer>
    <script type="application/json" id="blog-strings">${clientStrings}</script>
    <script type="module" src="${ctx.assets.js}"></script>
  </body>
</html>
`;
};

// The feed <link> comes from headTags (build/seo.js lists both feeds); added here only if not
const withFeedLink = (head, ctx, lang) =>
  head.includes('application/rss+xml')
    ? head
    : `${head}\n<link rel="alternate" type="application/rss+xml" title="${escapeHtml(ctx.strings[lang].feedTitle)}" href="${SITE_URL}${ctx.href(feedPath(lang))}" />`;

const person = (s) => ({
  '@type': 'Person',
  '@id': `${SITE_URL}/#person`,
  name: s.author,
  url: `${SITE_URL}/`,
});

const indexPage = (ctx, lang) => {
  const s = ctx.strings[lang];
  const path = ctx.href(indexPath(lang));
  const url = `${SITE_URL}${path}`;
  const head = headTags({
    title: s.indexTitle,
    description: s.indexDescription,
    path,
    lang,
    type: 'website',
    alternates: Object.fromEntries(LANGS.map((code) => [code, ctx.href(indexPath(code))])),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      '@id': `${url}#blog`,
      name: s.blogName,
      description: s.indexDescription,
      url,
      inLanguage: lang,
      author: person(s),
      isPartOf: { '@id': `${SITE_URL}/#website` },
      blogPost: ctx.posts.map((post) => ({
        '@type': 'BlogPosting',
        headline: post.langs[lang].title,
        url: `${SITE_URL}${ctx.href(postPath(lang, post.slug))}`,
        datePublished: post.date,
      })),
    },
  });

  const rssLink = `<a href="${ctx.href(feedPath(lang))}" class="text-link" type="application/rss+xml">${escapeHtml(s.rssFeed)}</a>`;
  const cards = ctx.posts
    .map(
      (post) => `        <li class="card-glass post-card">
          <h2 class="text-xl font-bold text-foreground sm:text-2xl"><a href="${ctx.href(postPath(lang, post.slug))}" class="stretched-link">${escapeHtml(post.langs[lang].title)}</a></h2>
          ${postMeta(post, lang, s)}
          <p class="text-base leading-relaxed text-foreground-muted">${escapeHtml(post.langs[lang].summary)}</p>
          ${tagList(post.tags, s.topics)}
        </li>`
    )
    .join('\n');

  const main = `      <div class="mx-auto max-w-3xl">
        <header>
          <h1 class="text-4xl font-black leading-tight sm:leading-none lg:leading-none tracking-tight text-foreground sm:text-5xl lg:text-6xl">${escapeHtml(s.indexHeading)}</h1>
          <p class="mt-4 max-w-prose text-base leading-relaxed sm:leading-7 text-foreground-muted sm:text-lg">${escapeHtml(s.indexDescription)}</p>
          <p class="mt-3 flex items-center gap-2 text-sm text-foreground-muted"><span class="text-primary-400">${ICONS.rss}</span><span>${fill(escapeHtml(s.subscribe), { rss: rssLink })}</span></p>
        </header>
        <ul class="mt-10 grid gap-6">
${cards}
        </ul>
      </div>`;

  return renderPage(ctx, {
    lang,
    head: withFeedLink(head, ctx, lang),
    alternatePaths: Object.fromEntries(LANGS.map((code) => [code, indexPath(code)])),
    current: 'index',
    main,
  });
};

const postPage = (ctx, lang, index) => {
  const s = ctx.strings[lang];
  const post = ctx.posts[index];
  const { title, summary, seo, body } = post.langs[lang];
  const path = ctx.href(postPath(lang, post.slug));
  const url = `${SITE_URL}${path}`;
  // With the site's name when it still fits in a search result's title
  const branded = fill(s.postTitle, { title: seo.title });
  const head = headTags({
    title: branded.length <= SEO_TITLE_MAX ? branded : seo.title,
    description: seo.description,
    path,
    lang,
    type: 'article',
    alternates: Object.fromEntries(
      LANGS.map((code) => [code, ctx.href(postPath(code, post.slug))])
    ),
    publishedTime: post.date,
    modifiedTime: post.date,
    tags: post.tags,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description: summary,
      url,
      mainEntityOfPage: url,
      inLanguage: lang,
      datePublished: post.date,
      dateModified: post.date,
      keywords: post.tags.join(', '),
      image: `${SITE_URL}${ctx.href('/og-image.png')}`,
      author: person(s),
      publisher: { '@id': `${SITE_URL}/#person` },
      isPartOf: { '@id': `${SITE_URL}${ctx.href(indexPath(lang))}#blog` },
    },
  });

  // Previous and next in the index order (newest first)
  const neighbor = (i, label, dir) => {
    const other = ctx.posts[i];
    if (!other) return '<span></span>';
    const icon = dir === 'prev' ? ICONS.arrowLeft : ICONS.arrowRight;
    return `<a href="${ctx.href(postPath(lang, other.slug))}" rel="${dir}" class="card-glass post-nav-link${dir === 'next' ? ' sm:text-right' : ''}">
            <span class="post-nav-label${dir === 'next' ? ' sm:justify-end' : ''}">${dir === 'prev' ? icon : ''}${escapeHtml(label)}${dir === 'next' ? icon : ''}</span>
            <span class="font-semibold text-foreground">${escapeHtml(other.langs[lang].title)}</span>
          </a>`;
  };

  const main = `      <article class="mx-auto max-w-3xl" aria-labelledby="post-title">
        <p><a href="${ctx.href(indexPath(lang))}" class="back-link">${ICONS.arrowLeft}${escapeHtml(s.allPosts)}</a></p>
        <header class="mt-6">
          <h1 id="post-title" class="text-3xl font-black leading-tight sm:leading-10 lg:leading-none tracking-tight text-foreground sm:text-4xl lg:text-5xl">${escapeHtml(title)}</h1>
          <p class="mt-4 text-base leading-relaxed sm:leading-7 text-foreground-muted sm:text-lg">${escapeHtml(summary)}</p>
          <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            ${postMeta(post, lang, s)}
            ${tagList(post.tags, s.topics)}
          </div>
        </header>
        <div class="card-glass mt-10 p-5 sm:p-10">
          <div class="prose-blog">
${renderMarkdown(body, s)}
          </div>
        </div>
      </article>
      <nav aria-label="${escapeHtml(s.morePosts)}" class="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
          ${neighbor(index - 1, s.previous, 'prev')}
          ${neighbor(index + 1, s.next, 'next')}
      </nav>`;

  return renderPage(ctx, {
    lang,
    head: withFeedLink(head, ctx, lang),
    alternatePaths: Object.fromEntries(LANGS.map((code) => [code, postPath(code, post.slug)])),
    current: 'post',
    main,
  });
};

/**
 * The site-wide 404 (/404.html). GitHub Pages serves it for any unknown path in either
 * language, so it is in English with a French line, and every URL in it is absolute.
 */
const notFoundPage = (ctx) => {
  const { en, fr } = ctx.strings;
  // Title, description and noindex only: a 404 has no canonical URL, alternates or social card
  const head = [
    `<title>${escapeHtml(en.notFoundTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(en.notFoundBody)}" />`,
    '<meta name="robots" content="noindex" />',
  ].join('\n    ');
  const main = `      <div class="mx-auto max-w-3xl">
        <h1 class="text-4xl font-black leading-tight sm:leading-none tracking-tight text-foreground sm:text-5xl">${escapeHtml(en.notFoundHeading)}</h1>
        <p class="mt-4 text-base leading-relaxed sm:leading-7 text-foreground-muted sm:text-lg">${escapeHtml(en.notFoundBody)}</p>
        <p lang="fr" class="mt-3 text-base leading-relaxed text-foreground-muted"><strong class="font-semibold text-foreground">${escapeHtml(fr.notFoundHeading)}.</strong> ${escapeHtml(fr.notFoundBody)}</p>
        <ul class="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-base">
          <li><a href="${ctx.href('/')}" class="text-link inline-block py-0.5">${escapeHtml(en.notFoundHome)}</a></li>
          <li><a href="${ctx.href(indexPath('en'))}" class="text-link inline-block py-0.5">${escapeHtml(en.notFoundBlog)}</a></li>
          <li><a href="${ctx.href(indexPath('fr'))}" lang="fr" hreflang="fr" class="text-link inline-block py-0.5">${escapeHtml(fr.notFoundBlog)}</a></li>
        </ul>
      </div>`;
  return renderPage(ctx, {
    lang: 'en',
    head,
    alternatePaths: Object.fromEntries(LANGS.map((code) => [code, indexPath(code)])),
    current: 'notfound',
    main,
  });
};

// ---------------------------------------------------------------------------------------------
// RSS 2.0

const feed = (ctx, lang) => {
  const s = ctx.strings[lang];
  const abs = (path) => `${SITE_URL}${ctx.href(path)}`;
  const items = ctx.posts
    .map((post) => {
      const link = abs(postPath(lang, post.slug));
      return [
        '    <item>',
        `      <title>${escapeXml(post.langs[lang].title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${rfc822(post.date)}</pubDate>`,
        `      <description>${escapeXml(post.langs[lang].summary)}</description>`,
        ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
        '    </item>',
      ].join('\n');
    })
    .join('\n');
  // The newest post date, so an unchanged blog gives an identical feed on every build
  const updated = ctx.posts[0] ? rfc822(ctx.posts[0].date) : null;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(s.feedTitle)}</title>`,
    `    <link>${escapeXml(abs(indexPath(lang)))}</link>`,
    `    <description>${escapeXml(s.indexDescription)}</description>`,
    `    <language>${lang}</language>`,
    ...(updated ? [`    <lastBuildDate>${updated}</lastBuildDate>`] : []),
    `    <atom:link href="${escapeXml(abs(feedPath(lang)))}" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
};

// ---------------------------------------------------------------------------------------------
// Plugin

export default function blog() {
  let root = process.cwd();
  let base = '/';
  let env = {};
  let isBuild = false;
  let entryRef = null;

  // '/blog/x/' -> the URL under the configured base
  const href = (path) => `${base}${path.replace(/^\//, '')}`;

  const context = async (assets) => ({
    root,
    href,
    assets,
    posts: await loadPosts(root),
    strings: loadStrings(root),
    analytics: analyticsTags(env),
    year: new Date().getFullYear(),
  });

  return {
    name: 'portfolio-blog',

    configResolved(config) {
      root = config.root;
      base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      isBuild = config.command === 'build';
      // VITE_ variables from .env files and from the process (CI passes repository variables)
      env = loadEnv(config.mode, config.envDir ?? config.root, 'VITE_');
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : null;
    },

    // Titles and summaries for the home page and the terminal; posts.js stays a normal module
    // (dates, tags), so editing it updates the page through HMR
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;
      const file = resolve(root, POSTS_FILE);
      this.addWatchFile(file);
      const posts = await loadIndex(root);
      const meta = {};
      for (const post of posts) {
        meta[post.slug] = {};
        for (const lang of LANGS) {
          const mdFile = resolve(root, CONTENT_DIR, post.slug, `${lang}.md`);
          this.addWatchFile(mdFile);
          const { title, summary } = readPostFile(root, post.slug, lang);
          meta[post.slug][lang] = { title, summary };
        }
      }
      return `import { posts } from ${JSON.stringify(file)};
const meta = ${JSON.stringify(meta)};
const byDate = (list) => [...list].sort((a, b) => b.date.localeCompare(a.date));
/** Posts, newest first: { slug, date, tags, title: { en, fr }, summary: { en, fr } } */
export const blogPosts = byDate(posts)
  .filter((post) => meta[post.slug])
  .map((post) => ({
    ...post,
    title: { en: meta[post.slug].en.title, fr: meta[post.slug].fr.title },
    summary: { en: meta[post.slug].en.summary, fr: meta[post.slug].fr.summary },
  }));
/** Path of the blog index or of one post for a language */
export const blogPath = (lang, slug) =>
  \`${base}\${lang === 'en' ? '' : \`\${lang}/\`}blog/\${slug ? \`\${slug}/\` : ''}\`;
export const feedPath = (lang) => \`\${blogPath(lang)}rss.xml\`;
`;
    },

    buildStart() {
      if (!isBuild) return;
      // The client entry of the generated pages, built as its own chunk with its own CSS
      entryRef = this.emitFile({ type: 'chunk', id: resolve(root, ENTRY), name: 'blog' });
    },

    async generateBundle(_, bundle) {
      if (!entryRef) return;
      const jsFile = this.getFileName(entryRef);
      // CSS imported by the entry and by the chunks it imports (Vite moves shared CSS out)
      const css = new Set();
      const seen = new Set();
      const collect = (fileName) => {
        const chunk = bundle[fileName];
        if (!chunk || chunk.type !== 'chunk' || seen.has(fileName)) return;
        seen.add(fileName);
        chunk.imports.forEach(collect);
        chunk.viteMetadata?.importedCss?.forEach((file) => css.add(file));
      };
      collect(jsFile);
      if (!css.size) this.warn('No CSS found for the blog entry; the pages would be unstyled');

      const ctx = await context({
        js: href(`/${jsFile}`),
        css: [...css].map((f) => href(`/${f}`)),
      });
      const emit = (path, source) =>
        this.emitFile({ type: 'asset', fileName: path.replace(/^\//, ''), source });

      for (const lang of LANGS) {
        emit(`${indexPath(lang)}index.html`, indexPage(ctx, lang));
        ctx.posts.forEach((post, i) =>
          emit(`${postPath(lang, post.slug)}index.html`, postPage(ctx, lang, i))
        );
        emit(feedPath(lang), feed(ctx, lang));
      }
      emit('/404.html', notFoundPage(ctx));
    },

    configureServer(server) {
      const contentDir = resolve(root, CONTENT_DIR);
      const postsFile = resolve(root, POSTS_FILE);
      const localesDir = resolve(root, 'src/locales');
      server.watcher.add(contentDir);

      // Re-render on change: the virtual module (home page, terminal) through HMR, and open
      // blog pages reload (src/blog/entry.js listens for this event)
      server.watcher.on('all', (_, file) => {
        const isBlogFile =
          file.startsWith(contentDir + sep) ||
          file === postsFile ||
          (file.startsWith(localesDir + sep) &&
            (file.endsWith(`${sep}blog.json`) || file.endsWith(`${sep}${PAGE_STRINGS}`)));
        if (!isBlogFile) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod && !file.endsWith('.json')) server.reloadModule(mod);
        server.ws.send({ type: 'custom', event: 'blog:update' });
      });

      // Runs before Vite's own middlewares (and its SPA fallback). Nothing may throw out of it:
      // an async middleware's rejection is unhandled and would stop the dev server.
      const blogPrefix = new RegExp(
        `^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:fr/)?blog(?:/|$)`
      );
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawPath = (req.url ?? '/').split('?')[0];
          const isNotFoundPage = rawPath === `${base}404.html`;
          // Cheap check on the raw path first: everything else goes straight to Vite
          if (!isNotFoundPage && !blogPrefix.test(rawPath)) return next();
          let pathname;
          try {
            pathname = decodeURIComponent(rawPath);
          } catch {
            // Malformed escape such as %E0%A4%A: not a blog URL, let Vite answer it
            return next();
          }

          const send = (status, type, body) => {
            res.statusCode = status;
            res.setHeader('Content-Type', `${type}; charset=utf-8`);
            res.setHeader('Cache-Control', 'no-cache');
            res.end(body);
          };
          // GitHub Pages redirects a directory without its slash the same way
          const redirect = (location) => {
            res.statusCode = 301;
            res.setHeader('Location', location);
            res.end();
          };

          // In dev, Vite serves the entry and its CSS itself; the client connects for HMR
          const ctx = await context({ js: `${base}${ENTRY}`, css: [] });
          const html = (page) =>
            page.replace(
              '<script type="module"',
              `<script type="module" src="${base}@vite/client"></script>\n    <script type="module"`
            );
          // What GitHub Pages serves for an unknown path
          const notFound = () => send(404, 'text/html', html(notFoundPage(ctx)));
          if (isNotFoundPage) return notFound();

          const match = /^(?:(fr)\/)?blog(\/.*)?$/.exec(pathname.slice(base.length));
          if (!match) return notFound();
          const lang = match[1] ?? 'en';
          const rest = match[2] ?? '';

          if (rest === '') return redirect(`${rawPath}/`);
          if (rest === '/rss.xml') return send(200, 'application/rss+xml', feed(ctx, lang));
          if (rest === '/' || rest === '/index.html')
            return send(200, 'text/html', html(indexPage(ctx, lang)));

          const post = /^\/([a-z0-9-]+)(\/|\/index\.html)?$/.exec(rest);
          const index = post ? ctx.posts.findIndex((p) => p.slug === post[1]) : -1;
          if (index >= 0 && !post[2]) return redirect(`${rawPath}/`);
          if (index >= 0) return send(200, 'text/html', html(postPage(ctx, lang, index)));
          return notFound();
        } catch (error) {
          // A rendering error (bad front matter, missing file): Vite's error page if nothing
          // was sent yet, otherwise end the response
          if (res.headersSent) return res.end();
          try {
            return next(error);
          } catch {
            res.statusCode = 500;
            return res.end();
          }
        }
      });
    },
  };
}
