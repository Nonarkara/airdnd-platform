import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * otop.nonarkara.org — built from otop/ as its own root, into dist-otop/.
 *
 * Deliberately a separate app rather than another route on the wellness site:
 * they share an engine, not a deploy, not an audience, and not a reputation.
 * `npx vite build --config vite.otop.config.js`
 */
export default defineConfig({
  root: 'otop',
  plugins: [react()],
  build: {
    outDir: '../dist-otop',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: { port: 5180 },
});
