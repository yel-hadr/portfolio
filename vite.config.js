import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // Served from the root of https://yel-hadr.github.io/ (the yel-hadr.github.io user-site repo)
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks. three/R3F/drei are only reached through the lazy 3D
        // layer (Scene3D, SceneViewImpl, scene components), so they stay off the first paint.
        manualChunks(id) {
          // Vite's lazy-import helper is used by the entry; left unassigned, Rollup hoists it
          // into vendor-r3f and every lazy import() then drags three.js into the first paint.
          if (id.includes('vite/preload-helper')) return 'vendor-react';
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/three\//.test(id)) return 'vendor-three';
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
