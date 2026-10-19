import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Two entries: the story (index.html) and the standalone multiplayer mode (mp.html).
// base is left to the CLI (--base=./) so both pages work on GitHub Pages sub-paths.
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), mp: resolve(import.meta.dirname, 'mp.html') },
    },
  },
});
