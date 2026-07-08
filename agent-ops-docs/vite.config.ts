import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site (not a username.github.io repo) under
// /<repo-name>/, so asset URLs need that base path in the production
// build. Local dev keeps base "/" — only the build command needs it.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/agent-ops/' : '/',
}));
