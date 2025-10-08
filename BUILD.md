# Build System Guide

HTMLPlayer builds for all platforms from a single codebase:

1. **Web (PWA)** – Progressive Web App for browsers
2. **Desktop (Tauri)** – Native desktop app via Tauri

## Commands

### Web Development (PWA)

Start the web dev server:

```bash
npm run dev        # or npm run dev:web
```

Build for production:

```bash
npm run build      # or npm run build:web
```

### Desktop Development (Tauri)

Install Tauri dependencies ([see docs](https://v2.tauri.app/start/prerequisites/#system-dependencies)) for your OS:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev xdg-utils
```

Start the desktop dev server:

```bash
npm run dev:desktop  # or npm run tauri
```

Build for desktop:

```bash
npm run build:desktop
```

## How It Works

### Environment-Based Configuration

The build system uses the `BUILD_TARGET` environment variable to select platform:

- `BUILD_TARGET=web` (default) – Builds for web/PWA
- `BUILD_TARGET=desktop` – Builds for desktop (Tauri)

All source code in `src/` is **shared**. Platform-specific logic should use runtime feature detection:

```typescript
// Platform detection
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

if (isTauri) {
  // Use Tauri APIs
} else {
  // Use web APIs
}
```

## Available Scripts

| Script                | Description                       |
|-----------------------|-----------------------------------|
| `npm run dev`         | Start web dev server (default)     |
| `npm run dev:web`     | Start web dev server explicitly    |
| `npm run dev:desktop` | Start desktop dev server           |
| `npm run build`       | Build for web (default)            |
| `npm run build:web`   | Build for web/PWA                  |
| `npm run build:desktop`| Build for desktop (Tauri)         |
| `npm run tauri`       | Run Tauri CLI                      |
| `npm start`           | Serve built web app locally        |
| `npm run preview`     | Preview production build           |
| `npm run lint`        | Check for TypeScript errors        |
| `npm run test`        | Run tests                          |
| `npm run count-lines` | Count lines of code                |
| `npm run i18n-check`  | Check i18n coverage                |

### i18n-izer.js

This is a small Node script I made that checks for missing i18n translation keys.

#### Parameters

- `--ignore-console`: Suppresses text that's found in console.log, console.warn, etc.
- `-I 'Dir1, File1'`: Ignores specified folders or files during searching

#### Usage Example

```bash
node scripts/i18n-izer.js -I "file", "folder" --ignore-console
```

This will run the script, ignores a `file` and the `folder`, and suppress console output.

For more details, see `Build/i18n-izer.js` or run with `--help`.
