import { defineConfig } from 'vite';

// Custom domain — qrforge.benrichardson.dev — so base is '/'.
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
