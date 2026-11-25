import { defineConfig } from 'vite';

// A static site: `bun run build` writes app/dist, which any static file server can serve under any path.
export default defineConfig({
    base: './',
    server: { port: 5190 },
    worker: { format: 'es' },
    build: { outDir: 'dist', emptyOutDir: true },
});
