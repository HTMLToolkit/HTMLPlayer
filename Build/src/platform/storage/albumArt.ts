import { getDb, STORES, tx, req } from "./db";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("albumArtStorage");

const MAX_CACHE = 50;

interface AlbumArtRecord {
  songId: string;
  albumArt: Blob;
}

const albumArtCache = new Map<string, string>();

function evictCache(): void {
  while (albumArtCache.size >= MAX_CACHE) {
    const oldest = albumArtCache.keys().next().value;
    if (oldest === undefined) break;
    revokeFromCache(oldest);
  }
}

function revokeFromCache(songId: string): void {
  const url = albumArtCache.get(songId);
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {}
  albumArtCache.delete(songId);
}

function cacheObjectUrl(songId: string, blob: Blob): string {
  revokeFromCache(songId);
  evictCache();
  const url = URL.createObjectURL(blob);
  albumArtCache.set(songId, url);
  return url;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(",");
  const meta = commaIndex === -1 ? "" : dataUrl.slice(0, commaIndex);
  const mimeType = meta.match(/^data:([^;]+);/)?.[1] ?? "image/png";
  const binary = atob(dataUrl.slice(commaIndex + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export const albumArtStorage = {
  async load(songId: string): Promise<string | null> {
    if (albumArtCache.has(songId)) {
      return albumArtCache.get(songId) ?? null;
    }

    try {
      const db = await getDb();
      const transaction = db.transaction([STORES.ALBUM_ART], "readonly");
      const record = await req<AlbumArtRecord | undefined>(
        transaction.objectStore(STORES.ALBUM_ART).get(songId),
      );

      if (record?.albumArt) {
        return cacheObjectUrl(songId, record.albumArt);
      }
      return null;
    } catch (error) {
      logger.error(`Failed to load album art for ${songId}:`, {
        error: String(error),
      });
      return null;
    }
  },

  async loadBatch(songIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const toLoad = songIds.filter((songId) => !albumArtCache.has(songId));
    for (const songId of songIds) {
      const cached = albumArtCache.get(songId);
      if (cached) result.set(songId, cached);
    }
    if (toLoad.length === 0) return result;

    try {
      const db = await getDb();
      const transaction = db.transaction([STORES.ALBUM_ART], "readonly");
      const store = transaction.objectStore(STORES.ALBUM_ART);

      for (const songId of toLoad) {
        const record = await req<AlbumArtRecord | undefined>(store.get(songId));
        if (record?.albumArt) {
          const url = cacheObjectUrl(songId, record.albumArt);
          result.set(songId, url);
        }
      }

      return result;
    } catch (error) {
      logger.error("Failed to load album art batch:", {
        error: String(error),
      });
      return result;
    }
  },

  async save(songId: string, blob: Blob): Promise<string | null> {
    try {
      await tx(STORES.ALBUM_ART, "readwrite", (transaction) =>
        req(
          transaction
            .objectStore(STORES.ALBUM_ART)
            .put({ songId, albumArt: blob }),
        ),
      );
      return cacheObjectUrl(songId, blob);
    } catch (error) {
      logger.error(`Failed to save album art for ${songId}:`, {
        error: String(error),
      });
      return null;
    }
  },

  async delete(songId: string): Promise<void> {
    revokeFromCache(songId);
    try {
      await tx(STORES.ALBUM_ART, "readwrite", (transaction) =>
        req(transaction.objectStore(STORES.ALBUM_ART).delete(songId)),
      );
    } catch (error) {
      logger.error(`Failed to delete album art for ${songId}:`, {
        error: String(error),
      });
    }
  },

  clearCache(): void {
    for (const songId of Array.from(albumArtCache.keys())) {
      revokeFromCache(songId);
    }
  },

  has(songId: string): boolean {
    return albumArtCache.has(songId);
  },

  get(songId: string): string | undefined {
    return albumArtCache.get(songId);
  },
};
