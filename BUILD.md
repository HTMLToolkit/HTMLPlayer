# Build System Guide

HTMLPlayer supports building for all platforms from a single codebase:
1. **Web (PWA)** - Progressive Web App for browsers
2. **Desktop** - Native app using Tauri

## Commands

### Web Development (PWA)

Run this to open the dev server.
```bash
npm run dev          # or npm run dev:web
```
Or for building:
```bash
npm run build:web    # Build for web/PWA
```

### Desktop Development (Tauri)
Install Tauri dependencies (check [the docs](https://v2.tauri.app/start/prerequisites/#system-dependencies)) for your OS.
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  xdg-utils
```
Run this to open the dev server.
```bash
npm run dev:desktop  # or npm run tauri:dev
```
Or for building:
```bash
npm run build:desktop  # Build native desktop app
```

## How It Works

### Environment-Based Configuration

The build system uses the `BUILD_TARGET` environment variable to determine which platform to build for:

- `BUILD_TARGET=web` (default) - Builds for web browsers with PWA support
- `BUILD_TARGET=desktop` - Builds for desktop with Tauri integration

### Source Code

All source code in `src/` is **shared between both platforms**. Platform-specific behavior should be handled at runtime using feature detection:

```typescript
// Example: Platform detection
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

if (isTauri) {
  // Use Tauri APIs
} else {
  // Use web APIs
}
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start web dev server (default) |
| `npm run dev:web` | Start web dev server explicitly |
| `npm run dev:desktop` | Start desktop dev server |
| `npm run build` | Build for web (default) |
| `npm run build:web` | Build for web/PWA |
| `npm run build:desktop` | Build for desktop |
| `npm run tauri` | Run Tauri |
| `npm start` | Serve built web app locally |
| `npm run preview` | Preview production build |
| `npm run lint` | Check for TypeScript errors |
