import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// HashRouter site (per issue #286 - GitHub Pages project sites have no
// server-side rewrite for deep-linked client-side routes, and this
// generator targets many different repos/domains, some with a custom
// domain at the root and some without, so base stays '/' and routing
// stays hash-based rather than relying on a 404.html redirect trick).
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
