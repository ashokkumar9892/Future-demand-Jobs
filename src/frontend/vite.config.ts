import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Demo mode runs the whole platform in the browser against the backend's own
// seed files, for static hosting where no .NET API exists. It is opt-in so a
// Docker or proxied deployment never silently serves fake data.
const DEMO_MODE = process.env.VITE_DEMO_MODE === 'true';

export default defineConfig({
  plugins: [react()],
  define: {
    __DEMO_MODE__: JSON.stringify(DEMO_MODE),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The demo content is the API's seed data, imported rather than copied,
      // so the two can never disagree about what a course or salary says.
      '@seed': path.resolve(__dirname, '../backend/FutureTech.Api/SeedData'),
    },
  },
  server: {
    port: 5173,
    // The SPA calls /api relative, so dev and container deployment behave the same.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:5080',
        changeOrigin: true,
      },
    },
    fs: {
      // Permit reading the seed files, which live outside the Vite root.
      allow: [path.resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Mermaid and the chart library used to be named manual chunks here, on
        // the reasoning that a separate chunk keeps them off the critical path.
        // It did the opposite. A named manual chunk is emitted as a static chunk
        // of the entry, so the bundler wrote <link rel="modulepreload"> for both
        // into index.html and every visitor downloaded them before first paint --
        // 5.4MB, 1.5MB gzipped, on the login screen, for a diagram library that
        // only a handful of routes ever render.
        //
        // Left to itself the bundler splits on the real boundaries: the pages are
        // already lazy, MermaidDiagram already imports mermaid dynamically, and
        // recharts becomes a shared chunk of the routes that chart. First load is
        // now 381KB raw / 117KB gzipped. Do not name these here again.
        //
        // Demo content stays manual: it is a build-time constant that is either
        // wholly present or tree-shaken away, never partially reachable.
        manualChunks(id) {
          if (id.includes('SeedData')) return 'demo-content';
          return undefined;
        },
      },
    },
  },
});
