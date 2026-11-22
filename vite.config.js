import { defineConfig } from 'vite';
import { securityMeta } from './build/security.js';

export default defineConfig({
  base: '/students_committee_chikchakchok/',
  plugins: [securityMeta()],
  build: {
    chunkSizeWarningLimit: 700, // the lazily loaded 3D chunk is ~570 KB (140 KB gzip)
    assetsInlineLimit: 0, // never inline assets as data: URLs (strict CSP font-src 'self')
  },
  test: { environment: 'jsdom' },
});
