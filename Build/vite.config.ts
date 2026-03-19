import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

//@ts-ignore
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";
import wasm from "vite-plugin-wasm";

// Moved from index.html for single file builds
import enMessages from "./src/locales/en/loading-messages-en.json";
import frMessages from "./src/locales/fr/loading-messages-fr.json";

// Check various env things
const host = process.env.TAURI_DEV_HOST;
const buildTarget = process.env.BUILD_TARGET || "web";

const isSingleFile = process.env.SINGLE_FILE === "true";
const isDesktop = buildTarget === "desktop";
const isWeb = buildTarget === "web";
const isStackBlitz =
  process.env.STACKBLITZ === "true" ||
  !!process.env.SHELL?.includes("jsh") ||
  !!process.env.VITE_URL?.includes("stackblitz");

const iconBase64 = isSingleFile
  ? `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, "public/icon-any.png")).toString("base64")}`
  : null;

// Conditional plugins based on target
const plugins = [
  react(),
  wasm(),
  isSingleFile &&
    viteSingleFile({
      useRecommendedBuildConfig: true,
      removeViteModuleLoader: true,
    }),
  {
    name: "html-transform",
    transformIndexHtml(html: string) {
      return html
        .replace(/__IS_SINGLE_FILE__/g, isSingleFile.toString())
        .replace(/__INLINED_ICON__/g, JSON.stringify(iconBase64))
        .replace(
          /__INLINED_MESSAGES__/g,
          isSingleFile
            ? JSON.stringify({ en: enMessages, fr: frMessages })
            : "null"
        );
    },
  },
].filter(Boolean);

if (!isStackBlitz) {
  const topLevelAwait = (await import("vite-plugin-top-level-await")).default;
  plugins.push(topLevelAwait());
}

// Only add PWA plugin for web builds and also not for single file builds for obvious reasons
if (isWeb && !isSingleFile) {
  plugins.push(
    VitePWA({
      registerType: "prompt",
      includeAssets: ["robots.txt"],

      strategies: "injectManifest",
      srcDir: "src/workers",
      filename: "sw.ts",
      injectRegister: "script",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        swSrc: "./src/workers/sw.ts",
      },

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
                  "application/octet-stream", // Picks up other files as well, but we handle that anyways
                  ".flo",
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
              "application/octet-stream": [".flo"],
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
        config: true,
      },
      workbox: {
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
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
        navigateFallbackAllowlist: [/^\/beta\/HTMLPlayer/],
      },
    })
  );
}

export default defineConfig({
  root: isDesktop ? "" : "./",
  appType: "spa",
  base: isDesktop ? "/" : "/beta/HTMLPlayer/",
  plugins,

  resolve: {
    alias: {
      "@": "/src",
      // For builds where the PWA plugin is disabled (desktop/single-file),
      // make `virtual:pwa-register/react` resolve to a no-op stub so Vite
      // can still bundle the code without the service worker dependency.
      ...(isWeb && !isSingleFile
        ? {}
        : {
            "virtual:pwa-register/react": path.resolve(
              __dirname,
              "src/stubs/virtual-pwa-register-react.ts",
            ),
          }),
    },
  },
  define: {
    __ENABLE_PWA_LOGIC__: isWeb && !isSingleFile,
    __IS_SINGLE_FILE__: isSingleFile,
    __INLINED_MESSAGES__: isSingleFile
      ? { en: enMessages, fr: frMessages }
      : null,
    __INLINED_ICON__: JSON.stringify(iconBase64),
  },

  esbuild: {
    target: isDesktop ? "es2021" : "esnext",
  },

  optimizeDeps: {
    esbuildOptions: {
      target: isDesktop ? "es2021" : "esnext",
    },
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
    target: isDesktop ? "es2021" : "esnext",
    sourcemap: true,
    outDir: "./dist",
    emptyOutDir: true,
    // Web builds need chunk splitting for better caching
    // Desktop builds can be simpler since it's all bundled
    ...(isWeb &&
      !isSingleFile && {
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
                "./src/ui/resources/visualizers/abstractart.visualizer.tsx",
                "./src/ui/resources/visualizers/architecturalblueprint.visualizer.tsx",
                "./src/ui/resources/visualizers/bargraph.visualizer.tsx",
                "./src/ui/resources/visualizers/biologicalcell.visualizer.tsx",
                "./src/ui/resources/visualizers/circuitboard.visualizer.tsx",
                "./src/ui/resources/visualizers/circularspectrogram.visualizer.tsx",
                "./src/ui/resources/visualizers/circularwave.visualizer.tsx",
                "./src/ui/resources/visualizers/cityscape.visualizer.tsx",
                "./src/ui/resources/visualizers/constellation.visualizer.tsx",
                "./src/ui/resources/visualizers/cosmicpulse.visualizer.tsx",
                "./src/ui/resources/visualizers/crystal.visualizer.tsx",
                "./src/ui/resources/visualizers/crystalv2.visualizer.tsx",
                "./src/ui/resources/visualizers/dna.visualizer.tsx",
                "./src/ui/resources/visualizers/dnav2.visualizer.tsx",
                "./src/ui/resources/visualizers/firespectrum.visualizer.tsx",
                "./src/ui/resources/visualizers/flower.visualizer.tsx",
                "./src/ui/resources/visualizers/fluid.visualizer.tsx",
                "./src/ui/resources/visualizers/fluidwave.visualizer.tsx",
                "./src/ui/resources/visualizers/fractal.visualizer.tsx",
                "./src/ui/resources/visualizers/fracture.visualizer.tsx",
                "./src/ui/resources/visualizers/fracturedcircle.visualizer.tsx",
                "./src/ui/resources/visualizers/fracturedprism.visualizer.tsx",
                "./src/ui/resources/visualizers/frequencyflower.visualizer.tsx",
                "./src/ui/resources/visualizers/frequencymesh.visualizer.tsx",
                "./src/ui/resources/visualizers/frequencystars.visualizer.tsx",
                "./src/ui/resources/visualizers/galaxy.visualizer.tsx",
                "./src/ui/resources/visualizers/galaxyv2.visualizer.tsx",
                "./src/ui/resources/visualizers/geometricpulse.visualizer.tsx",
                "./src/ui/resources/visualizers/interference.visualizer.tsx",
                "./src/ui/resources/visualizers/kaleidoscope.visualizer.tsx",
                "./src/ui/resources/visualizers/kaleidoscopespectrogram.visualizer.tsx",
                "./src/ui/resources/visualizers/layeredripplevoronoi.visualizer.tsx",
                "./src/ui/resources/visualizers/liquidmetal.visualizer.tsx",
                "./src/ui/resources/visualizers/matrixrain.visualizer.tsx",
                "./src/ui/resources/visualizers/nebula.visualizer.tsx",
                "./src/ui/resources/visualizers/neonwave.visualizer.tsx",
                "./src/ui/resources/visualizers/neural.visualizer.tsx",
                "./src/ui/resources/visualizers/neurospectogram.visualizer.tsx",
                "./src/ui/resources/visualizers/oceanwaves.visualizer.tsx",
                "./src/ui/resources/visualizers/organic.visualizer.tsx",
                "./src/ui/resources/visualizers/oscilloscope.visualizer.tsx",
                "./src/ui/resources/visualizers/particlefield.visualizer.tsx",
                "./src/ui/resources/visualizers/pixeldust.visualizer.tsx",
                "./src/ui/resources/visualizers/pulsingorbs.visualizer.tsx",
                "./src/ui/resources/visualizers/quantum.visualizer.tsx",
                "./src/ui/resources/visualizers/rainbowspiral.visualizer.tsx",
                "./src/ui/resources/visualizers/ribbondance.visualizer.tsx",
                "./src/ui/resources/visualizers/sacredgeometry.visualizer.tsx",
                "./src/ui/resources/visualizers/spectrumripple.visualizer.tsx",
                "./src/ui/resources/visualizers/spiralspectogram.visualizer.tsx",
                "./src/ui/resources/visualizers/spiralv2.visualizer.tsx",
                "./src/ui/resources/visualizers/starfield.visualizer.tsx",
                "./src/ui/resources/visualizers/tesselation.visualizer.tsx",
                "./src/ui/resources/visualizers/topwater.visualizer.tsx",
                "./src/ui/resources/visualizers/voltaicarcs.visualizer.tsx",
                "./src/ui/resources/visualizers/voronoi.visualizer.tsx",
                "./src/ui/resources/visualizers/vortex.visualizer.tsx",
                "./src/ui/resources/visualizers/water.visualizer.tsx",
                "./src/ui/resources/visualizers/waterfall.visualizer.tsx",
                "./src/ui/resources/visualizers/waveformrings.visualizer.tsx",
                "./src/ui/resources/visualizers/waveformspectrum.visualizer.tsx",
                "./src/ui/resources/visualizers/waveformtunnel.visualizer.tsx",
                "./src/ui/resources/visualizers/waveinterference.visualizer.tsx",
                "./src/ui/resources/visualizers/weather.visualizer.tsx",
              ],
            },
          },
        },
      }),
    ...(isSingleFile && {
      assetsInlineLimit: 100000000, // force all assets to inline
      chunkSizeWarningLimit: 100000,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          manualChunks: undefined,
        },
      },
    }),
  },
  ...(!isSingleFile && {
    worker: {
      format: "es",
    },
  }),
  ...(isSingleFile && {
    worker: {
      format: "iife",
      plugins: () => [wasm()], // Futureproofing
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  }),
});
