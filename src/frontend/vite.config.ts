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
        // Mermaid, Monaco and the chart library are large and route-specific;
        // keeping them out of the main chunk keeps first paint fast.
        manualChunks(id) {
          if (id.includes('node_modules/mermaid')) return 'mermaid';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'charts';
          if (id.includes('node_modules/monaco-editor')) return 'monaco';
          if (id.includes('SeedData')) return 'demo-content';
          return undefined;
        },
      },
    },
  },
});
