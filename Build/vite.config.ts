import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: './',
  base: './',  // <- relative base
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['robots.txt'],
      manifest: {
        name: 'HTMLPlayerBeta',
        short_name: 'HTMLPlayerBeta',
        start_url: './',  // <- relative start URL
        display: 'standalone',
        theme_color: '#00bfff',
        background_color: '#00bfff',
      },
      pwaAssets: {
        image: 'public/icon-1024.png',
        preset: 'minimal-2023',
        includeHtmlHeadLinks: true,
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /.*\.(js|css|ts|tsx|html)$/, // remove leading slash
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell' },
          },
          {
            urlPattern: /.*\.(png|ico|json)$/, // remove leading slash
            handler: 'CacheFirst',
            options: { cacheName: 'assets' },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': '/src' } },
  server: { open: true, allowedHosts:true },
  build: { sourcemap: true, outDir: './dist', emptyOutDir: true },
});
