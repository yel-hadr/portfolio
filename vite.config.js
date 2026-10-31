import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import blog from './build/blog.js';
import seo from './build/seo.js';
import preloadFont from './build/preloadFont.js';

// https://vite.dev/config/
export default defineConfig({
  // Served from the root of https://yel-hadr.github.io/ (the yel-hadr.github.io user-site repo)
  base: '/',
  // blog: Markdown posts -> static /blog/ pages + RSS. seo: meta/OG/JSON-LD, analytics, sitemap.
  // The React Compiler memoizes components and hooks it can prove pure (React 19 target), so
  // they need no hand-written useMemo/useCallback; the ones it skips keep theirs
  plugins: [
    react({ babel: { plugins: [['babel-plugin-react-compiler', { target: '19' }]] } }),
    tailwindcss(),
    blog(),
    seo(),
    preloadFont(),
  ],
  build: {
    // vendor-three is three.js whole (about 690 kB minified, 178 kB gzipped): one library, loaded
    // only when the page's 3D layer, a demo or Game Mode needs it, never on the first paint.
    // Splitting it would not shrink what a visitor downloads, so the warning sits just above it
    chunkSizeWarningLimit: 720,
    // Images are never inlined as base64: src/constans imports every tech icon, and the navbar
    // and Hero import src/constans, so each icon under Vite's 4 KB limit landed in the
    // first-paint chunk (about 30 kB of base64 that gzip barely shrinks) though only the Tech
    // section shows them. As files they are fetched when an image or a ball texture asks
    assetsInlineLimit: (file) => (/\.(webp|png|jpe?g)$/.test(file) ? false : undefined),
    rollupOptions: {
      // Pages: the portfolio and the /status/ page (its own small React entry)
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        status: resolve(import.meta.dirname, 'status/index.html'),
      },
      output: {
        // Long-lived vendor chunks. three/R3F/drei are only reached through the lazy 3D
        // layer (Scene3D, SceneViewImpl, scene components), so they stay off the first paint.
        manualChunks(id) {
          // Vite's lazy-import helper is used by the entry; left unassigned, Rollup hoists it
          // into vendor-r3f and every lazy import() then drags three.js into the first paint.
          if (id.includes('vite/preload-helper')) return 'vendor-react';
          // Tiny shared modules, kept out of chunks of their own: ReleaseContext goes with R3F (the
          // page Canvas uses it too), the theme reader with the demos
          if (id.includes('src/components/canvas/ReleaseContext')) return 'vendor-r3f';
          if (id.includes('src/utils/themeColors')) return 'vendor-r3f-demos';
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/three\//.test(id)) return 'vendor-three';
          // Post-processing, used only by Game Mode's facility look: its own chunk, fetched with it
          if (/node_modules\/(@react-three\/postprocessing|postprocessing|n8ao)\//.test(id))
            return 'vendor-postfx';
          // drei/three-stdlib parts only the live demos and Game Mode use (cub3D, FdF): their own chunk, so the
          // page's 3D layer (vendor-r3f) does not grow for visitors who never open a demo. Not
          // PerspectiveCamera: the page's ViewCamera uses it too
          if (
            /node_modules\/(@react-three\/drei\/(core\/(OrbitControls|PointerLockControls|PerformanceMonitor)|web\/Html)|three-stdlib\/controls\/(OrbitControls|PointerLockControls|EventDispatcher))\.js/.test(
              id
            )
          )
            return 'vendor-r3f-demos';
          if (
            /node_modules\/(@react-three|three-stdlib|three-mesh-bvh|maath|tunnel-rat|zustand|its-fine|suspend-react|react-reconciler)/.test(
              id
            )
          )
            return 'vendor-r3f';
          if (/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id))
            return 'vendor-motion';
          // Small helpers only lazy code uses (the timeline below the hero, the 3D stack): a chunk
          // of their own, which no first-paint chunk imports, so it is not preloaded. Left
          // unassigned, Rollup would put them in vendor-r3f and the timeline would pull three.js
          if (
            /node_modules\/(react-is|prop-types|classnames|react-intersection-observer|use-sync-external-store)\//.test(
              id
            )
          )
            return 'vendor-shared';
          if (/node_modules\/(react|react-dom|scheduler|@babel\/runtime)\//.test(id))
            return 'vendor-react';
          return undefined;
        },
      },
    },
  },

  optimizeDeps: { exclude: ['fsevents'] },
});
