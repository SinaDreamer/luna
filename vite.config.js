import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the same build loads in Electron (app://) and Capacitor (capacitor://).
  base: './',
  plugins: [react()],
  // The Firebase SDK makes the single bundle ~900 kB; fine for a desktop/mobile app shell.
  build: { chunkSizeWarningLimit: 1200 },
  test: { environment: 'node' },
});
