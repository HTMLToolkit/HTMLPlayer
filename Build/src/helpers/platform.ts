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
    return typeof window !== 'undefined' && !('__TAURI__' in window);
  },

  /**
   * Check if running in Tauri desktop app
   */
  get isDesktop(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  },

  /**
   * Check if PWA features are available
   */
  get isPWA(): boolean {
    return 'serviceWorker' in navigator;
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
    return this.isWeb && 'BeforeInstallPromptEvent' in window;
  },
};

/**
 * Example: Unified file picker that works on both platforms
 */
export async function openFileDialog(options: {
  multiple?: boolean;
  accept?: string;
}): Promise<File[]> {
  if (platform.isDesktop) {
    // Use Tauri's native file picker
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: options.multiple ?? false,
      filters: options.accept
        ? [
            {
              name: 'Audio Files',
              extensions: options.accept.split(',').map((ext) => ext.replace('.', '')),
            },
          ]
        : undefined,
    });

    if (!selected) return [];

    // Convert Tauri paths to File objects
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const paths = Array.isArray(selected) ? selected : [selected];

    const files = await Promise.all(
      paths.map(async (path) => {
        const contents = await readFile(path);
        const fileName = path.split('/').pop() ?? 'unknown';
        return new File([contents], fileName);
      })
    );

    return files;
  } else {
    // Use web file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options.multiple ?? false;
      if (options.accept) {
        input.accept = options.accept;
      }
      input.onchange = () => {
        resolve(Array.from(input.files || []));
      };
      input.click();
    });
  }
}

/**
 * Example: Show native notification
 */
export async function showNotification(title: string, body: string): Promise<void> {
  if (platform.isDesktop) {
    // Use Tauri's native notifications
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({ title, body });
  } else {
    // Use web Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    }
  }
}

/**
 * Example: Get app version
 */
export async function getAppVersion(): Promise<string> {
  if (platform.isDesktop) {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } else {
    // Return version from package.json or manifest
    return '2.0.0'; // I might want to inject this at build time
  }
}
