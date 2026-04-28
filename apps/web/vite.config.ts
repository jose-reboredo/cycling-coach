import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

// PARS — Vite config
// Frontend deploys via Workers Static Assets attached to ../../src/worker.js.
// In dev we proxy auth + API to the Worker (run `npm run dev:all` from repo
// root to start both Worker and Vite).

const TARGET = 'http://127.0.0.1:8787';
const forward = () => ({ target: TARGET, changeOrigin: false });

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // The Worker's userOrigin() reads X-Forwarded-Host to build the correct
    // OAuth redirect_uri (localhost:5173 in dev, not 127.0.0.1:8787).
    // We set the header explicitly because Vite's xfwd flag and configure()
    // hook are both unreliable.
    proxy: {
      '/api':        forward(),
      '/authorize':  forward(),
      '/callback':   forward(),
      '/refresh':    forward(),
      '/coach':      forward(),
      '/coach-ride': forward(),
      '/version':    forward(),
      '/webhook':    forward(),
      '/roadmap':    forward(),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        // Predictable chunking — vendor split keeps app code small per route.
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router':       ['@tanstack/react-router'],
          'query':        ['@tanstack/react-query'],
          'motion':       ['motion'],
        },
      },
    },
  },
});
