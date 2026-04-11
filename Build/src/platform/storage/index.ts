import { BaseStorageBackend, PlatformType } from "./base";
import { WebStorageBackend } from "./webStorage";
import { DesktopStorageBackend } from "./desktopStorage";

export { albumArtStorage } from "./albumArt";
export { dialogStorage } from "./dialogs";
export { audioStorage, type AudioData } from "./audio";
export { getDb, STORES, closeDb } from "./db";

export async function clearAllCaches(): Promise<void> {
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

export function detectPlatform(): PlatformType {
  const ua = navigator.userAgent;
  if (/Electron|Tauri/.test(ua)) return "desktop";
  if (/Mobi|Android/i.test(ua)) return "mobile";
  return "web";
}

let storageInstance: BaseStorageBackend | null = null;

export function getStorageBackend(): BaseStorageBackend {
  if (storageInstance) return storageInstance;

  const platform = detectPlatform();

  if (platform === "desktop") {
    storageInstance = new DesktopStorageBackend();
  } else {
    storageInstance = new WebStorageBackend();
  }

  return storageInstance;
}

export function getAudioLoader(): BaseStorageBackend {
  return getStorageBackend();
}

export { BaseStorageBackend, type PlatformType };
