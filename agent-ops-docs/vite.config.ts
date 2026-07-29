import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// HashRouter site (per issue #286 - GitHub Pages project sites have no
// server-side rewrite for deep-linked client-side routes, and this
// generator targets many different repos/domains, some with a custom
// domain at the root and some without, so routing stays hash-based rather
// than relying on a 404.html redirect trick).
//
// agent-ops is served as a GitHub Pages *project* site at
// https://heyitschloe.github.io/agent-ops/ (no custom domain), so the
// production build needs base '/agent-ops/' for asset URLs to resolve -
// the same base the previous hand-built docs site used. Dev keeps '/'.
// This is a per-repo, hand-owned override of the generator's '/' default;
// the generator only ever rewrites src/data/*.generated.* and content, so
// it won't clobber this.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/agent-ops/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
