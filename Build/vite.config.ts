import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

//@ts-ignore
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";
import wasm from "vite-plugin-wasm";

import enMessages from "./src/locales/en/loading-messages-en.json" with {
  type: "json",
};
import frMessages from "./src/locales/fr/loading-messages-fr.json" with {
  type: "json",
};

const host = process.env.TAURI_DEV_HOST;
const buildTarget = process.env.BUILD_TARGET || "web";

const isSingleFile = process.env.SINGLE_FILE === "true";
const isDesktop = buildTarget === "desktop";
const isWeb = buildTarget === "web";

const iconBase64 = isSingleFile
  ? `data:image/png;base64,${fs.readFileSync(path.resolve(import.meta.dirname, "public/icon-any.png")).toString("base64")}`
  : null;

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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, 
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
                  "application/octet-stream", 
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

const VENDOR_CHUNK_GROUPS: Readonly<Record<string, readonly string[]>> = {
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
  "vendor-uppy": ["@uppy/core", "@uppy/react", "@uppy/dashboard"],
  "vendor-i18n": [
    "i18next",
    "i18next-browser-languagedetector",
    "i18next-http-backend",
    "react-i18next",
  ],
  "vendor-audio": ["music-metadata", "@web-scrobbler/metadata-filter"],
  "vendor-utils": ["lodash", "dompurify", "zustand", "sonner"],
  "vendor-icons": ["lucide-react"],
  "vendor-flo": ["@flo-audio/libflo-audio", "@flo-audio/reflo"],
};

function manualChunks(id: string): string | undefined {
  const separator = "/node_modules/";
  const index = id.indexOf(separator);
  if (index === -1) {
    if (id.includes("/src/ui/resources/visualizers/")) return "visualizers";
    return undefined;
  }
  const rest = id.slice(index + separator.length);
  const packageName = rest.startsWith("@")
    ? rest.split("/").slice(0, 2).join("/")
    : rest.split("/")[0];
  for (const [chunk, packages] of Object.entries(VENDOR_CHUNK_GROUPS)) {
    if (packages.some((name) => packageName === name)) return chunk;
  }
  return undefined;
}

export default defineConfig({
  root: isDesktop ? "" : "./",
  appType: "spa",
  base: isDesktop ? "/" : "/beta/HTMLPlayer/",
  plugins,

  resolve: {
    alias: {
      "@": "/src",
      ...(isWeb && !isSingleFile
        ? {}
        : {
            "virtual:pwa-register/react": path.resolve(
              import.meta.dirname,
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
    exclude: ["@flo-audio/libflo-audio", "@flo-audio/reflo"],
  },

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
          ignored: ["**/src-tauri/**"],
        },
      }
    : {
        open: true,
        allowedHosts: true,
      },

  clearScreen: isDesktop ? false : undefined,

  build: {
    target: isDesktop ? "es2021" : "esnext",
    sourcemap: true,
    outDir: "./dist",
    emptyOutDir: true,
    ...(isWeb &&
      !isSingleFile && {
        chunkSizeWarningLimit: 1000, 
        rollupOptions: {
          input: {
            main: "./index.html",
            privacy: "./privacy.html",
            terms: "./terms.html",
          },
          output: {
            manualChunks,
          },
        },
      }),
    ...(isSingleFile && {
      assetsInlineLimit: 100000000, 
      chunkSizeWarningLimit: 100000,
      rollupOptions: {
        output: {
          codeSplitting: false,
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
      plugins: () => [wasm()], 
      rollupOptions: {
        output: {
          codeSplitting: false,
        },
      },
    },
  }),
});
