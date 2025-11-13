// Platform Detection Utilities
// Use these helpers throughout the app to handle platform-specific behavior

/**
 * Platform capabilities and feature detection
 */
export const platform = {
  /**
   * Check if running in a web browser (not Tauri)
   */
  get isWeb(): boolean {
    return typeof window !== "undefined" && !("__TAURI__" in window);
  },

  /**
   * Check if running in Tauri desktop app
   */
  get isDesktop(): boolean {
    return typeof window !== "undefined" && "__TAURI__" in window;
  },

  /**
   * Check if PWA features are available
   */
  get isPWA(): boolean {
    return "serviceWorker" in navigator;
  },

  /**
   * Check if IndexedDB is available
   */
  get hasIndexedDB(): boolean {
    return typeof indexedDB !== "undefined";
  },

  /**
   * Check if native file system is available (Tauri)
   */
  get hasNativeFileSystem(): boolean {
    return this.isDesktop;
  },

  /**
   * Check if native dialogs are available (Tauri)
   */
  get hasNativeDialogs(): boolean {
    return this.isDesktop;
  },

  /**
   * Check if can install as PWA
   */
  get canInstallPWA(): boolean {
    return this.isWeb && "BeforeInstallPromptEvent" in window;
  },

  /**
   * Check if Web Audio API is available
   */
  get hasWebAudio(): boolean {
    return (
      typeof AudioContext !== "undefined" ||
      typeof (window as any).webkitAudioContext !== "undefined"
    );
  },

  /**
   * Detect Safari browser (for background playback workarounds)
   */
  get isSafari(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    return (
      /^((?!chrome|android).)*safari/i.test(ua) || /iphone|ipad|ipod/i.test(ua)
    );
  },
};

/**
 * Audio file picker - unified interface for web and desktop
 * Uses Uppy Dashboard on web, native file picker on desktop
 */
export async function pickAudioFiles(options?: {
  multiple?: boolean;
}): Promise<File[]> {
  if (platform.isDesktop) {
    // Use Tauri's native file picker
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: options?.multiple ?? true,
      filters: [
        {
          name: "Audio Files",
          extensions: [
            "mp3",
            "wav",
            "m4a",
            "flac",
            "aif",
            "aiff",
            "ogg",
            "opus",
            "webm",
          ],
        },
      ],
    });

    if (!selected) return [];

    // Convert Tauri paths to File objects
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const paths = Array.isArray(selected) ? selected : [selected];

    const files = await Promise.all(
      paths.map(async (path) => {
        const contents = await readFile(path);
        const fileName = path.split("/").pop() ?? "unknown";
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "mp3";

        // Determine MIME type from extension
        const mimeTypes: Record<string, string> = {
          mp3: "audio/mpeg",
          wav: "audio/wav",
          m4a: "audio/mp4",
          flac: "audio/flac",
          aif: "audio/aiff",
          aiff: "audio/aiff",
          ogg: "audio/ogg",
          opus: "audio/opus",
          webm: "audio/webm",
        };

        return new File([contents], fileName, {
          type: mimeTypes[ext] || "audio/mpeg",
        });
      }),
    );

    return files;
  } else {
    // Web: Use existing Uppy implementation from filePickerHelper.tsx
    // This returns a promise that resolves when user completes selection
    const { pickAudioFiles: webPickAudioFiles } = await import(
      "./filePickerHelper"
    );
    const audioFiles = await webPickAudioFiles();
    return audioFiles.map((af) => af.file);
  }
}

/**
 * Export playlist file - unified interface for web and desktop
 */
export async function exportPlaylistFile(
  content: string,
  fileName: string,
  fileType: "json" | "m3u",
): Promise<void> {
  const mimeType = fileType === "json" ? "application/json" : "audio/x-mpegurl";
  const blob = new Blob([content], { type: mimeType });

  if (platform.isDesktop) {
    // Use Tauri's native save dialog
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");

    const filePath = await save({
      defaultPath: fileName,
      filters: [
        {
          name: fileType === "json" ? "JSON Files" : "M3U Playlist",
          extensions: [fileType],
        },
      ],
    });

    if (filePath) {
      await writeTextFile(filePath, content);
    }
  } else {
    // Web: Use download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/**
 * Import playlist file - unified interface for web and desktop
 */
export async function importPlaylistFile(): Promise<File | null> {
  if (platform.isDesktop) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");

    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Playlist Files",
          extensions: ["json", "m3u", "m3u8"],
        },
      ],
    });

    if (!selected || Array.isArray(selected)) return null;

    const content = await readTextFile(selected);
    const fileName = selected.split("/").pop() ?? "playlist";
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "json";
    const mimeType = ext === "json" ? "application/json" : "audio/x-mpegurl";

    return new File([content], fileName, { type: mimeType });
  } else {
    // Web: Use file input
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,.m3u,.m3u8";
      input.onchange = () => {
        resolve(input.files?.[0] || null);
      };
      input.click();
    });
  }
}

/**
 * Show native notification
 */
export async function showNotification(
  title: string,
  body: string,
): Promise<void> {
  if (platform.isDesktop) {
    // Use Tauri's native notifications
    try {
      const { sendNotification } = await import(
        "@tauri-apps/plugin-notification"
      );
      await sendNotification({ title, body });
    } catch (error) {
      console.warn("Desktop notification failed:", error);
    }
  } else {
    // Use web Notification API
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (
      "Notification" in window &&
      Notification.permission !== "denied"
    ) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification(title, { body });
      }
    }
  }
}

/**
 * Get app version
 */
export async function getAppVersion(): Promise<string> {
  if (platform.isDesktop) {
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      return await getVersion();
    } catch {
      return "2.0.0";
    }
  } else {
    // Return version from package.json
    return "2.0.0";
  }
}

/**
 * Open external URL in default browser
 */
export async function openExternal(url: string): Promise<void> {
  if (platform.isDesktop) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Check if a specific audio format is supported
 */
export function isAudioFormatSupported(format: string): boolean {
  const audio = document.createElement("audio");
  const canPlay = audio.canPlayType(format);
  return canPlay === "probably" || canPlay === "maybe";
}

/**
 * Get persistent storage estimate (IndexedDB usage)
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
} | null> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;
      return { usage, quota, percentage };
    } catch (error) {
      console.warn("Failed to get storage estimate:", error);
      return null;
    }
  }
  return null;
}
