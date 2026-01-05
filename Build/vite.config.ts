import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// Detect build target: 'web' (default) or 'desktop' (Tauri)
const buildTarget = process.env.BUILD_TARGET || "web";
const isDesktop = buildTarget === "desktop";
const isWeb = buildTarget === "web";

const host = process.env.TAURI_DEV_HOST;

// Conditional plugins based on target
const plugins = [react(), wasm(), topLevelAwait()];

// Only add PWA plugin for web builds
if (isWeb) {
  plugins.push(
    VitePWA({
      registerType: "prompt",
      includeAssets: ["robots.txt"],
      manifest: {
        id: "htmlplayer",
        name: "HTMLPlayer (beta)",
        short_name: "HTMLPlayer(beta)",
        description:
          "A modern music player interface with playlists, song management, visualizers, and offline support.",
        categories: ["music", "audio", "entertainment", "tools"],
        start_url: "/beta/HTMLPlayer/",
        scope: "/beta/HTMLPlayer/",
        display: "standalone",
        theme_color: "#00bfff",
        background_color: "#00bfff",
        orientation: "any",
        share_target: {
          action: "/beta/HTMLPlayer/",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
            files: [
              {
                name: "audio",
                accept: [
                  "audio/*",
                  ".mp3",
                  ".wav",
                  ".flac",
                  ".m4a",
                  ".aif",
                  ".aiff",
                  ".ogg",
                  ".opus",
                ],
              },
            ],
          },
        },
        file_handlers: [
          {
            action: "/beta/HTMLPlayer/",
            accept: {
              "audio/mpeg": [".mp3"],
              "audio/wav": [".wav"],
              "audio/flac": [".flac"],
              "audio/mp4": [".m4a"],
              "audio/aiff": [".aif", ".aiff"],
              "audio/ogg": [".ogg"],
              "audio/opus": [".opus"],
            },
          },
        ],
        screenshots: [
          {
            src: "./screenshots/MainUI.png",
            sizes: "1854x926",
            type: "image/png",
            label: "Main Player UI",
          },
          {
            src: "./screenshots/CustomizedUI.png",
            sizes: "1854x926",
            type: "image/png",
            label: "Customized with the Nebula theme and Phosphor icons",
          },
          {
            src: "./screenshots/LyricsandVisualizer.png",
            sizes: "1854x926",
            type: "image/png",
            label: "Lyrics and Visualizer View",
          },
          {
            src: "./screenshots/MainUI-Mobile.png",
            sizes: "624x927",
            type: "image/png",
            label: "Main Player UI on Mobile",
          },
          {
            src: "./screenshots/CustomizedUI-Mobile.png",
            sizes: "624x927",
            type: "image/png",
            label:
              "Customized with the Nebula theme and Phosphor icons on Mobile",
          },
          {
            src: "./screenshots/LyricsandVisualizer-Mobile.png",
            sizes: "624x927",
            type: "image/png",
            label: "Lyrics and Visualizer View on Mobile",
          },
        ],
      },
      pwaAssets: {
        config:true,
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
          {
            urlPattern: /.*\.(js|css|ts|tsx|html)$/,
            handler: "NetworkFirst",
            options: { cacheName: "app-shell" },
          },
          {
            urlPattern: /.*\.(png|ico|json)$/,
            handler: "CacheFirst",
            options: { cacheName: "assets" },
          },
        ],
      },
      // Enable PWA in development mode for testing
      devOptions: {
        enabled: true,
        type: "module",
      },
    })
  );
}

export default defineConfig({
  root: isDesktop ? "" : "./",
  base: "./",
  plugins,
  resolve: {
    alias: {
      "@": "/src",
    },
  },

  optimizeDeps: {
    exclude: ["@flo-audio/libflo-audio", "@flo-audio/reflo"],
  },

  // Platform-specific server config
  server: isDesktop
    ? {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
          protocol: "ws",
          host,
          port: 1421,
        }
        : undefined,
      watch: {
        // Tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    }
    : {
      open: true,
      allowedHosts: true,
    },

  // Prevent vite from obscuring rust errors (desktop only)
  clearScreen: isDesktop ? false : undefined,

  build: {
    sourcemap: true,
    outDir: "./dist",
    emptyOutDir: true,
    // Web builds need chunk splitting for better caching
    // Desktop builds can be simpler since it's all bundled
    ...(isWeb && {
      chunkSizeWarningLimit: 1000, // Increase warning limit to 1000kb
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks for large libraries
            "vendor-react": ["react", "react-dom"],
            "vendor-ui": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tooltip",
            ],
            "vendor-uppy": ["@uppy/core", "@uppy/react"],
            "vendor-i18n": [
              "i18next",
              "i18next-browser-languagedetector",
              "i18next-http-backend",
              "react-i18next",
            ],
            "vendor-audio": [
              "music-metadata",
              "@web-scrobbler/metadata-filter",
            ],
            "vendor-utils": ["lodash", "dompurify", "zustand", "sonner"],
            "vendor-icons": ["lucide-react"],
            "vendor-flo": ["@flo-audio/libflo-audio", "@flo-audio/reflo"],

            // Visualizers chunk - group all visualizers together
            visualizers: [
              "./src/visualizers/abstractart.visualizer.tsx",
              "./src/visualizers/architecturalblueprint.visualizer.tsx",
              "./src/visualizers/bargraph.visualizer.tsx",
              "./src/visualizers/biologicalcell.visualizer.tsx",
              "./src/visualizers/circuitboard.visualizer.tsx",
              "./src/visualizers/circularspectrogram.visualizer.tsx",
              "./src/visualizers/circularwave.visualizer.tsx",
              "./src/visualizers/cityscape.visualizer.tsx",
              "./src/visualizers/constellation.visualizer.tsx",
              "./src/visualizers/cosmicpulse.visualizer.tsx",
              "./src/visualizers/crystal.visualizer.tsx",
              "./src/visualizers/crystalv2.visualizer.tsx",
              "./src/visualizers/dna.visualizer.tsx",
              "./src/visualizers/dnav2.visualizer.tsx",
              "./src/visualizers/firespectrum.visualizer.tsx",
              "./src/visualizers/flower.visualizer.tsx",
              "./src/visualizers/fluid.visualizer.tsx",
              "./src/visualizers/fluidwave.visualizer.tsx",
              "./src/visualizers/fractal.visualizer.tsx",
              "./src/visualizers/fracture.visualizer.tsx",
              "./src/visualizers/fracturedcircle.visualizer.tsx",
              "./src/visualizers/fracturedprism.visualizer.tsx",
              "./src/visualizers/frequencyflower.visualizer.tsx",
              "./src/visualizers/frequencymesh.visualizer.tsx",
              "./src/visualizers/frequencystars.visualizer.tsx",
              "./src/visualizers/galaxy.visualizer.tsx",
              "./src/visualizers/galaxyv2.visualizer.tsx",
              "./src/visualizers/geometricpulse.visualizer.tsx",
              "./src/visualizers/interference.visualizer.tsx",
              "./src/visualizers/kaleidoscope.visualizer.tsx",
              "./src/visualizers/kaleidoscopespectrogram.visualizer.tsx",
              "./src/visualizers/layeredripplevoronoi.visualizer.tsx",
              "./src/visualizers/liquidmetal.visualizer.tsx",
              "./src/visualizers/matrixrain.visualizer.tsx",
              "./src/visualizers/nebula.visualizer.tsx",
              "./src/visualizers/neonwave.visualizer.tsx",
              "./src/visualizers/neural.visualizer.tsx",
              "./src/visualizers/neurospectogram.visualizer.tsx",
              "./src/visualizers/oceanwaves.visualizer.tsx",
              "./src/visualizers/organic.visualizer.tsx",
              "./src/visualizers/oscilloscope.visualizer.tsx",
              "./src/visualizers/particlefield.visualizer.tsx",
              "./src/visualizers/pixeldust.visualizer.tsx",
              "./src/visualizers/pulsingorbs.visualizer.tsx",
              "./src/visualizers/quantum.visualizer.tsx",
              "./src/visualizers/rainbowspiral.visualizer.tsx",
              "./src/visualizers/ribbondance.visualizer.tsx",
              "./src/visualizers/sacredgeometry.visualizer.tsx",
              "./src/visualizers/spectrumripple.visualizer.tsx",
              "./src/visualizers/spiralspectogram.visualizer.tsx",
              "./src/visualizers/spiralv2.visualizer.tsx",
              "./src/visualizers/starfield.visualizer.tsx",
              "./src/visualizers/tesselation.visualizer.tsx",
              "./src/visualizers/topwater.visualizer.tsx",
              "./src/visualizers/voltaicarcs.visualizer.tsx",
              "./src/visualizers/voronoi.visualizer.tsx",
              "./src/visualizers/vortex.visualizer.tsx",
              "./src/visualizers/water.visualizer.tsx",
              "./src/visualizers/waterfall.visualizer.tsx",
              "./src/visualizers/waveformrings.visualizer.tsx",
              "./src/visualizers/waveformspectrum.visualizer.tsx",
              "./src/visualizers/waveformtunnel.visualizer.tsx",
              "./src/visualizers/waveinterference.visualizer.tsx",
              "./src/visualizers/weather.visualizer.tsx",
            ],
          },
        },
      },
    }),
  },
  worker: {
    format: "es",
  },
});
