import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseChangelog } from './src/lib/changelogParser';

// PARS — Vite config
// Frontend deploys via Workers Static Assets attached to ../../src/worker.js.
// In dev we proxy auth + API to the Worker (run `npm run dev:all` from repo
// root to start both Worker and Vite).
//
// When E2E_TARGET_PROD=1 is set (e.g. in GitHub Actions), the proxy
// targets the deployed prod Worker instead of localhost:8787 — so smoke
// tests don't need a side-by-side wrangler dev process to satisfy
// /roadmap, /version, etc.

const TARGET =
  process.env.E2E_TARGET_PROD === '1'
    ? 'https://cycling-coach.josem-reboredo.workers.dev'
    : 'http://127.0.0.1:8787';
const forward = () => ({ target: TARGET, changeOrigin: true, secure: true });

// Vite plugin — reads CHANGELOG.md at the repo root, parses it, and exposes
// the entries via a synthetic module ID. Components import:
//   import entries from 'virtual:changelog';
const CHANGELOG_VIRTUAL_ID = 'virtual:changelog';
const CHANGELOG_RESOLVED_ID = '\0' + CHANGELOG_VIRTUAL_ID;

const changelogPlugin = () => ({
  name: 'changelog',
  resolveId(id: string) {
    if (id === CHANGELOG_VIRTUAL_ID) return CHANGELOG_RESOLVED_ID;
    return null;
  },
  load(id: string) {
    if (id !== CHANGELOG_RESOLVED_ID) return null;
    const md = readFileSync(resolve(__dirname, '../../CHANGELOG.md'), 'utf-8');
    const entries = parseChangelog(md);
    return `export default ${JSON.stringify(entries)};`;
  },
});

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    changelogPlugin(),
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
