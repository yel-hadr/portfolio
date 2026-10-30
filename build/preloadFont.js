/**
 * Preloads the hero heading's font (Geist 900, latin) on the pages that show it. The browser
 * would otherwise find it only once the CSS and the app's script have run, and the heading's
 * repaint in that font is the page's largest contentful paint: preloading lets it download in
 * parallel with the script. Build only (the dev server serves the font from node_modules).
 */
export default function preloadFont() {
  return {
    name: 'preload-hero-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !/\/index\.html$/.test(ctx.filename) || /status/.test(ctx.filename))
          return html;
        const font = Object.keys(ctx.bundle).find((name) =>
          /geist-latin-900-normal-[^/]+\.woff2$/.test(name)
        );
        if (!font) return html;
        return {
          html,
          tags: [
            {
              tag: 'link',
              attrs: {
                rel: 'preload',
                as: 'font',
                type: 'font/woff2',
                href: `/${font}`,
                crossorigin: '',
              },
              injectTo: 'head',
            },
          ],
        };
      },
    },
  };
}
