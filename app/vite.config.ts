import { defaultClientConditions, defineConfig } from 'vite';

// A static site: `bun run build` writes app/dist, which any static file server can serve under any path.
// `source`: the package's TypeScript, not its built dist/, so a change there shows without building it.
export default defineConfig({
    base: './',
    server: { port: 5190 },
    resolve: { conditions: ['source', ...defaultClientConditions] },
    worker: { format: 'es' },
    // three.js in a chunk of its own: it changes less often than the page, so browsers keep it cached.
    build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 800, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
