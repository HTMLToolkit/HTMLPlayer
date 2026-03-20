const DB_NAME = "HTMLPlayerDB";
const DB_VERSION = 2;
const STORE = "albumArt";

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "songId" });
      }
    };
  });
};

const albumArtCache = new Map<string, string>();
const MAX_CACHE = 50;

export const albumArtStorage = {
  async load(songId: string): Promise<string | null> {
    if (albumArtCache.has(songId)) {
      return albumArtCache.get(songId)!;
    }

    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readonly");
      const store = tx.objectStore(STORE);

      const result = await new Promise<{ songId: string; albumArt: string } | undefined>((resolve, reject) => {
        const req = store.get(songId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      db.close();

      if (result?.albumArt) {
        evictCache();
        albumArtCache.set(songId, result.albumArt);
        return result.albumArt;
      }

      return null;
    } catch (error) {
      console.error(`Failed to load album art for ${songId}:`, error);
      return null;
    }
  },

  async loadBatch(songIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const toLoad: string[] = [];

    for (const songId of songIds) {
      if (albumArtCache.has(songId)) {
        result.set(songId, albumArtCache.get(songId)!);
      } else {
        toLoad.push(songId);
      }
    }

    if (toLoad.length === 0) return result;

    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readonly");
      const store = tx.objectStore(STORE);

      const loaded = await Promise.all(
        toLoad.map((songId) =>
          new Promise<{ songId: string; albumArt: string } | null>((resolve, reject) => {
            const req = store.get(songId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          })
        )
      );

      db.close();

      for (const art of loaded) {
        if (art?.albumArt) {
          evictCache();
          albumArtCache.set(art.songId, art.albumArt);
          result.set(art.songId, art.albumArt);
        }
      }

      return result;
    } catch (error) {
      console.error("Failed to load album art batch:", error);
      return result;
    }
  },

  async save(songId: string, albumArt: string): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readwrite");
      const store = tx.objectStore(STORE);

      await new Promise<void>((resolve, reject) => {
        const req = store.put({ songId, albumArt });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      db.close();
      evictCache();
      albumArtCache.set(songId, albumArt);
    } catch (error) {
      console.error(`Failed to save album art for ${songId}:`, error);
    }
  },

  clearCache(): void {
    albumArtCache.clear();
  },

  has(songId: string): boolean {
    return albumArtCache.has(songId);
  },

  get(songId: string): string | undefined {
    return albumArtCache.get(songId);
  },

  set(songId: string, albumArt: string): void {
    evictCache();
    albumArtCache.set(songId, albumArt);
  },
};

function evictCache() {
  if (albumArtCache.size >= MAX_CACHE) {
    const firstKey = albumArtCache.keys().next().value;
    if (firstKey) albumArtCache.delete(firstKey);
  }
}
