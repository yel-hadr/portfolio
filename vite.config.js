import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://yel-hadr.github.io/portfolio/ (GitHub Pages project site)
  base: '/portfolio/',
  plugins: [react()],

  optimizeDeps: { exclude: ["fsevents"] },
})
