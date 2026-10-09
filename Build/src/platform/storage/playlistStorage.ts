import type { Playlist, PlaylistFolder } from "../../core/engine/types";
import { isPlaylistItem, isPlainObject } from "../../core/engine/validators";
import { getDb, STORES, tx, req } from "./db";

export const playlistStorage = {
  async savePlaylists(playlists: (Playlist | PlaylistFolder)[]): Promise<void> {
    await tx(STORES.PLAYLISTS, "readwrite", (transaction) => {
      const store = transaction.objectStore(STORES.PLAYLISTS);
      store.clear();
      return Promise.all(playlists.map((playlist) => req(store.put(playlist))));
    });
  },

  async loadPlaylists(): Promise<(Playlist | PlaylistFolder)[]> {
    const db = await getDb();
    const transaction = db.transaction([STORES.PLAYLISTS], "readonly");
    const raw = await req<unknown[]>(
      transaction.objectStore(STORES.PLAYLISTS).getAll(),
    );
    return Array.isArray(raw) ? raw.filter(isPlaylistItem) : [];
  },
};

export const favoritesStorage = {
  async saveFavorites(favorites: string[]): Promise<void> {
    await tx(STORES.FAVORITES, "readwrite", (transaction) => {
      const store = transaction.objectStore(STORES.FAVORITES);
      store.clear();
      return Promise.all(favorites.map((id) => req(store.put({ id }))));
    });
  },

  async loadFavorites(): Promise<string[]> {
    const db = await getDb();
    const transaction = db.transaction([STORES.FAVORITES], "readonly");
    const raw = await req<unknown[]>(
      transaction.objectStore(STORES.FAVORITES).getAll(),
    );
    return Array.isArray(raw)
      ? raw
          .filter(
            (record): record is { id: string } =>
              isPlainObject(record) && typeof record.id === "string",
          )
          .map((record) => record.id)
      : [];
  },
};
