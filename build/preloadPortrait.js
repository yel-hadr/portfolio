import { PORTRAIT_SIZES } from '../src/heroPortrait.js';

/**
 * Preloads the hero portrait (the first screen's largest image, its LCP on phones) in the built
 * index.html. Without it the browser finds the image only once the app's script has rendered the
 * hero. Same srcset and sizes as the <img>, so the preload fetches the file the image will use;
 * fetchpriority high, as on the <img>. Build only (the dev server serves the source files).
 */
export default function preloadPortrait() {
  return {
    name: 'preload-hero-portrait',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !/\/index\.html$/.test(ctx.filename) || /status/.test(ctx.filename))
          return html;
        const file = (width) =>
          Object.keys(ctx.bundle).find((name) =>
            new RegExp(`(^|/)profile-${width}-[^/]+\\.webp$`).test(name)
          );
        const small = file(320);
        const large = file(640);
        if (!small || !large) return html;
        return {
          html,
          tags: [
            {
              tag: 'link',
              attrs: {
                rel: 'preload',
                as: 'image',
                type: 'image/webp',
                href: `/${large}`,
                imagesrcset: `/${small} 320w, /${large} 640w`,
                imagesizes: PORTRAIT_SIZES,
                fetchpriority: 'high',
              },
              injectTo: 'head',
            },
          ],
        };
      },
    },
  };
}
