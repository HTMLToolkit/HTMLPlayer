export interface KeyboardShortcut {
  id: string;
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: string;
  description: string;
  category: string;
}

export interface ShortcutConfig {
  [actionId: string]: KeyboardShortcut;
}

const DB_NAME = 'HTMLPlayerShortcuts';
const DB_VERSION = 1;
const STORE_NAME = 'shortcuts';

// Default keyboard shortcuts configuration
export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  playPause: {
    id: 'playPause',
    key: ' ',
    action: 'playPause',
    description: 'Play/Pause',
    category: 'playback'
  },
  nextSong: {
    id: 'nextSong',
    key: 'ArrowRight',
    action: 'nextSong',
    description: 'Next Song',
    category: 'playback'
  },
  previousSong: {
    id: 'previousSong',
    key: 'ArrowLeft',
    action: 'previousSong',
    description: 'Previous Song',
    category: 'playback'
  },
  volumeUp: {
    id: 'volumeUp',
    key: 'ArrowUp',
    action: 'volumeUp',
    description: 'Volume Up',
    category: 'audio'
  },
  volumeDown: {
    id: 'volumeDown',
    key: 'ArrowDown',
    action: 'volumeDown',
    description: 'Volume Down',
    category: 'audio'
  },
  mute: {
    id: 'mute',
    key: 'm',
    action: 'mute',
    description: 'Mute/Unmute',
    category: 'audio'
  },
  toggleShuffle: {
    id: 'toggleShuffle',
    key: 's',
    action: 'toggleShuffle',
    description: 'Toggle Shuffle',
    category: 'playback'
  },
  toggleRepeat: {
    id: 'toggleRepeat',
    key: 'r',
    action: 'toggleRepeat',
    description: 'Toggle Repeat',
    category: 'playback'
  },
  toggleLyrics: {
    id: 'toggleLyrics',
    key: 'l',
    action: 'toggleLyrics',
    description: 'Toggle Lyrics',
    category: 'interface'
  },
  toggleVisualizer: {
    id: 'toggleVisualizer',
    key: 'v',
    action: 'toggleVisualizer',
    description: 'Toggle Visualizer',
    category: 'interface'
  },
  search: {
    id: 'search',
    key: 'f',
    ctrlKey: true,
    action: 'search',
    description: 'Open Search',
    category: 'navigation'
  },
  openSettings: {
    id: 'openSettings',
    key: ',',
    ctrlKey: true,
    action: 'openSettings',
    description: 'Open Settings',
    category: 'navigation'
  }
};

class ShortcutsIndexedDbHelper {
  private db: IDBDatabase | null = null;

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('action', 'action', { unique: true });
          store.createIndex('category', 'category', { unique: false });
        }
      };
    });
  }

  async ensureDB(): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }
  }

  async getAllShortcuts(): Promise<ShortcutConfig> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = async () => {
        const shortcuts = request.result;
        if (shortcuts.length === 0) {
          // Save default shortcuts to IndexedDB on first run
          try {
            await this.saveAllShortcuts(DEFAULT_SHORTCUTS);
            resolve(DEFAULT_SHORTCUTS);
          } catch (error) {
            // If saving fails, still return defaults
            resolve(DEFAULT_SHORTCUTS);
          }
        } else {
          // Convert array to config object
          const config: ShortcutConfig = {};
          shortcuts.forEach((shortcut: KeyboardShortcut) => {
            config[shortcut.id] = shortcut;
          });
          resolve(config);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to get shortcuts'));
      };
    });
  }

  async saveShortcut(shortcut: KeyboardShortcut): Promise<void> {
    await this.ensureDB();
    
    // Validate that shortcut has required properties
    if (!shortcut.id) {
      throw new Error('Shortcut must have an id property');
    }
    if (!shortcut.key) {
      throw new Error('Shortcut must have a key property');
    }
    if (!shortcut.action) {
      throw new Error('Shortcut must have an action property');
    }
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(shortcut);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to save shortcut'));
      };
    });
  }

  async saveAllShortcuts(shortcuts: ShortcutConfig): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Clear existing shortcuts
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Save all new shortcuts
        const promises: Promise<void>[] = [];
        
        Object.values(shortcuts).forEach((shortcut) => {
          promises.push(new Promise((resolveShortcut, rejectShortcut) => {
            const addRequest = store.add(shortcut);
            addRequest.onsuccess = () => resolveShortcut();
            addRequest.onerror = () => rejectShortcut(new Error(`Failed to save shortcut ${shortcut.id}`));
          }));
        });

        Promise.all(promises)
          .then(() => resolve())
          .catch(reject);
      };

      clearRequest.onerror = () => {
        reject(new Error('Failed to clear existing shortcuts'));
      };
    });
  }

  async resetToDefaults(): Promise<void> {
    await this.saveAllShortcuts(DEFAULT_SHORTCUTS);
  }

  async deleteShortcut(shortcutId: string): Promise<void> {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(shortcutId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete shortcut'));
      };
    });
  }

  async isShortcutConflict(shortcut: KeyboardShortcut, excludeId?: string): Promise<boolean> {
    const allShortcuts = await this.getAllShortcuts();
    
    return Object.values(allShortcuts).some((existing) => {
      if (excludeId && existing.id === excludeId) {
        return false;
      }
      
      return (
        existing.key === shortcut.key &&
        (existing.ctrlKey || false) === (shortcut.ctrlKey || false) &&
        (existing.altKey || false) === (shortcut.altKey || false) &&
        (existing.shiftKey || false) === (shortcut.shiftKey || false)
      );
    });
  }
}

// Export a singleton instance
export const shortcutsDb = new ShortcutsIndexedDbHelper();

// Utility functions for formatting shortcuts
export function formatShortcutKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');
  
  let key = shortcut.key;
  if (key === ' ') key = 'Space';
  else if (key === 'ArrowUp') key = '↑';
  else if (key === 'ArrowDown') key = '↓';
  else if (key === 'ArrowLeft') key = '←';
  else if (key === 'ArrowRight') key = '→';
  else if (key.length === 1) key = key.toUpperCase();
  
  parts.push(key);
  return parts.join(' + ');
}

export function parseKeyEvent(event: KeyboardEvent): Partial<KeyboardShortcut> {
  return {
    key: event.key,
    ctrlKey: event.ctrlKey || undefined,
    altKey: event.altKey || undefined,
    shiftKey: event.shiftKey || undefined
  };
}