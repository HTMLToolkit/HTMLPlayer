import { getDb, STORES } from "./db";

const albumArtCache = new Map<string, string>();
const MAX_CACHE = 50;

function evictCache() {
  if (albumArtCache.size >= MAX_CACHE) {
    const firstKey = albumArtCache.keys().next().value;
    if (firstKey) albumArtCache.delete(firstKey);
  }
}

export const albumArtStorage = {
  async load(songId: string): Promise<string | null> {
    if (albumArtCache.has(songId)) {
      return albumArtCache.get(songId)!;
    }

    try {
      const db = await getDb();
      const tx = db.transaction(STORES.ALBUM_ART, "readonly");
      const store = tx.objectStore(STORES.ALBUM_ART);

      const result = await new Promise<
        { songId: string; albumArt: string } | undefined
      >((resolve, reject) => {
        const req = store.get(songId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

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
      const db = await getDb();
      const tx = db.transaction(STORES.ALBUM_ART, "readonly");
      const store = tx.objectStore(STORES.ALBUM_ART);

      const loaded = await Promise.all(
        toLoad.map(
          (songId) =>
            new Promise<{ songId: string; albumArt: string } | null>(
              (resolve, reject) => {
                const req = store.get(songId);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
              },
            ),
        ),
      );

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
      const db = await getDb();
      const tx = db.transaction(STORES.ALBUM_ART, "readwrite");
      const store = tx.objectStore(STORES.ALBUM_ART);

      await new Promise<void>((resolve, reject) => {
        const req = store.put({ songId, albumArt });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

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
};
