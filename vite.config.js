import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base: './' — щоб працювало за HA Ingress (шлях /api/hassio_ingress/<token>/)
export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 4000 },
  server: {
    proxy: {
      // локальна розробка: node server.js на 8099 з HA_URL/HA_TOKEN
      '/api': { target: 'http://localhost:8099', ws: true },
    },
  },
});
