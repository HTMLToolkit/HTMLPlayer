import type { Playlist, PlaylistFolder } from "../../core/engine/types";
import { isPlaylistItem, isPlainObject } from "../../core/engine/validators";
import { getDb, STORES } from "./unifiedDB";

export const playlistStorage = {
  async savePlaylists(playlists: (Playlist | PlaylistFolder)[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORES.PLAYLISTS, "readwrite");
    const store = tx.objectStore(STORES.PLAYLISTS);

    store.clear();
    for (const playlist of playlists) {
      store.put(playlist);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async loadPlaylists(): Promise<(Playlist | PlaylistFolder)[]> {
    const db = await getDb();
    const tx = db.transaction(STORES.PLAYLISTS, "readonly");
    const store = tx.objectStore(STORES.PLAYLISTS);

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const raw = req.result;
        const playlists = Array.isArray(raw)
          ? raw.filter(isPlaylistItem)
          : [];
        resolve(playlists);
      };
      req.onerror = () => reject(req.error);
    });
  },
};

export const favoritesStorage = {
  async saveFavorites(favorites: string[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORES.FAVORITES, "readwrite");
    const store = tx.objectStore(STORES.FAVORITES);

    store.clear();
    for (const id of favorites) {
      store.put({ id });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async loadFavorites(): Promise<string[]> {
    const db = await getDb();
    const tx = db.transaction(STORES.FAVORITES, "readonly");
    const store = tx.objectStore(STORES.FAVORITES);

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result;
        const ids = Array.isArray(results)
          ? results.filter(
              (r): r is { id: string } =>
                isPlainObject(r) && typeof r.id === "string",
            ).map((r) => r.id)
          : [];
        resolve(ids);
      };
      req.onerror = () => reject(req.error);
    });
  },
};
