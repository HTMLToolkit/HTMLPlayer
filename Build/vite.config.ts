import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: './',  // project root folder
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    open: true, // Opens browser on start
  },
  build: {
    sourcemap: true,
    outDir: '../dist',
    emptyOutDir: true,
  },
});
