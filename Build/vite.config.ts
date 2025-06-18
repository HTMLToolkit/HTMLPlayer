import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'public',  // point to your public folder
  plugins: [react()],
  resolve: {
    alias: {
      // Optional: if you want to use '@' as shortcut to src
      '@': '/src',
    },
  },
  server: {
    port: 3000, // Optional, default 5173
    open: true, // Opens browser on start
  },
  build: {
    sourcemap: true, // Optional: generates source maps
    outDir: 'dist',
  },
});
