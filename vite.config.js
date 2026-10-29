import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

import blog from './build/blog.js';
import seo from './build/seo.js';

// https://vite.dev/config/
export default defineConfig({
  // Served from the root of https://yel-hadr.github.io/ (the yel-hadr.github.io user-site repo)
  base: '/',
  // blog: Markdown posts -> static /blog/ pages + RSS. seo: meta/OG/JSON-LD, analytics, sitemap.
  plugins: [react(), blog(), seo()],
  build: {
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
          // drei/three-stdlib parts only the live demos use (cub3D, FdF): their own chunk, so the
          // page's 3D layer (vendor-r3f) does not grow for visitors who never open a demo. Not
          // PerspectiveCamera: the page's ViewCamera uses it too
          if (
            /node_modules\/(@react-three\/drei\/(core\/(OrbitControls|PointerLockControls)|web\/Html)|three-stdlib\/controls\/(OrbitControls|PointerLockControls|EventDispatcher))\.js/.test(
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
          // Small helpers shared by the 3D stack and the DOM sections (timeline): keep them with
          // React, or Rollup puts them in vendor-r3f and the entry then preloads three.js.
          if (
            /node_modules\/(react|react-dom|scheduler|react-is|prop-types|@babel\/runtime|classnames|react-intersection-observer|use-sync-external-store)\//.test(
              id
            )
          )
            return 'vendor-react';
          return undefined;
        },
      },
    },
  },

  optimizeDeps: { exclude: ['fsevents'] },
});
