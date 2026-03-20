import type { Track, Playlist, PlaylistFolder } from "../../core/engine/types";
import type { LibraryState } from "./types";

const DB_NAME = "htmlplayer-library";
const DB_VERSION = 1;

const STORES = {
  SONGS: "songs",
  PLAYLISTS: "playlists",
  FAVORITES: "favorites",
  SETTINGS: "settings",
} as const;

interface DBSchema {
  [STORES.SONGS]: Track;
  [STORES.PLAYLISTS]: Playlist | PlaylistFolder;
  [STORES.FAVORITES]: string;
  [STORES.SETTINGS]: { key: string; value: unknown };
}

class LibraryPersistence {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;

  constructor() {
    this.dbReady = this.initDB();
  }

  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error("Failed to open database"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.SONGS)) {
          db.createObjectStore(STORES.SONGS, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
          db.createObjectStore(STORES.PLAYLISTS, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
          db.createObjectStore(STORES.FAVORITES, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
        }
      };
    });
  }

  async getDB(): Promise<IDBDatabase> {
    return this.dbReady;
  }

  async saveSongs(songs: Track[]): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.SONGS, "readwrite");
    const store = transaction.objectStore(STORES.SONGS);

    for (const song of songs) {
      store.put(song);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadSongs(): Promise<Track[]> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.SONGS, "readonly");
    const store = transaction.objectStore(STORES.SONGS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSong(song: Track): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.SONGS, "readwrite");
    const store = transaction.objectStore(STORES.SONGS);
    store.put(song);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteSong(songId: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.SONGS, "readwrite");
    const store = transaction.objectStore(STORES.SONGS);
    store.delete(songId);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async savePlaylists(playlists: (Playlist | PlaylistFolder)[]): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.PLAYLISTS, "readwrite");
    const store = transaction.objectStore(STORES.PLAYLISTS);

    store.clear();
    for (const playlist of playlists) {
      store.put(playlist);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadPlaylists(): Promise<(Playlist | PlaylistFolder)[]> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.PLAYLISTS, "readonly");
    const store = transaction.objectStore(STORES.PLAYLISTS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveFavorites(favorites: string[]): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.FAVORITES, "readwrite");
    const store = transaction.objectStore(STORES.FAVORITES);

    store.clear();
    for (const id of favorites) {
      store.put({ id });
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadFavorites(): Promise<string[]> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.FAVORITES, "readonly");
    const store = transaction.objectStore(STORES.FAVORITES);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        resolve(results.map((r: { id: string }) => r.id));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSetting(key: string, value: unknown): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.SETTINGS, "readwrite");
    const store = transaction.objectStore(STORES.SETTINGS);
    store.put({ key, value });

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadSetting<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    const transaction = db.transaction(STORES.SETTINGS, "readonly");
    const store = transaction.objectStore(STORES.SETTINGS);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result as { key: string; value: T } | undefined;
        resolve(result?.value ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async loadFullLibrary(): Promise<LibraryState> {
    const [songs, playlists, favorites] = await Promise.all([
      this.loadSongs(),
      this.loadPlaylists(),
      this.loadFavorites(),
    ]);

    return {
      songs,
      playlists,
      favorites,
      searchQuery: "",
    };
  }

  async saveFullLibrary(state: LibraryState): Promise<void> {
    await Promise.all([
      this.saveSongs(state.songs),
      this.savePlaylists(state.playlists),
      this.saveFavorites(state.favorites),
    ]);
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(Object.values(STORES), "readwrite");

    for (const storeName of Object.values(STORES)) {
      transaction.objectStore(storeName).clear();
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const libraryPersistence = new LibraryPersistence();
export { LibraryPersistence };
export type { DBSchema };
