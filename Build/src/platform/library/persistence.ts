import type { Track, PlaylistItem } from "../../core/engine/types";
import type { LibraryState } from "./types";
import { SCHEMA_VERSION } from "../validators";
import { trackStorage } from "../storage/trackStorage";
import { playlistStorage, favoritesStorage } from "../storage/playlistStorage";
import { getDb, STORES } from "../storage/unifiedDB";

const META_SCHEMA_KEY = "schemaVersion";

function waitForTransactionCompletion(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Discards the library when the persisted schema is unknown (older build or
 * unversioned data). Entry-level sanitizers in the storage layer already drop
 * malformed records; this guards against whole-shape changes between builds.
 */
async function ensureLibrarySchema(): Promise<void> {
  const db = await getDb();
  const readTx = db.transaction(STORES.META, "readonly");
  const getReq = readTx.objectStore(STORES.META).get(META_SCHEMA_KEY);
  const existing = await new Promise<number | undefined>((resolve, reject) => {
    getReq.onsuccess = () => resolve(getReq.result?.value);
    getReq.onerror = () => reject(getReq.error);
  });
  if (existing === SCHEMA_VERSION) return;

  const clearTx = db.transaction(
    [STORES.TRACKS, STORES.PLAYLISTS, STORES.FAVORITES],
    "readwrite",
  );
  for (const storeName of [
    STORES.TRACKS,
    STORES.PLAYLISTS,
    STORES.FAVORITES,
  ]) {
    clearTx.objectStore(storeName).clear();
  }
  await waitForTransactionCompletion(clearTx);

  const putTx = db.transaction(STORES.META, "readwrite");
  putTx.objectStore(STORES.META).put({
    key: META_SCHEMA_KEY,
    value: SCHEMA_VERSION,
  });
  await waitForTransactionCompletion(putTx);
}

class LibraryPersistence {
  async saveSong(song: Track, audioData?: ArrayBuffer): Promise<void> {
    await trackStorage.saveTrack(song, audioData);
  }

  async deleteSong(songId: string): Promise<void> {
    await trackStorage.deleteTrack(songId);
  }

  async loadSongs(): Promise<Track[]> {
    return trackStorage.loadAllTracks();
  }

  async saveFavorites(favorites: string[]): Promise<void> {
    await favoritesStorage.saveFavorites(favorites);
  }

  async savePlaylists(playlists: PlaylistItem[]): Promise<void> {
    await playlistStorage.savePlaylists(playlists);
  }

  async loadFullLibrary(): Promise<LibraryState> {
    await ensureLibrarySchema();
    const [songs, playlists, favorites] = await Promise.all([
      this.loadSongs(),
      playlistStorage.loadPlaylists(),
      favoritesStorage.loadFavorites(),
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
      trackStorage.saveTracks(state.songs),
      playlistStorage.savePlaylists(state.playlists),
      favoritesStorage.saveFavorites(state.favorites),
    ]);
  }

  async clearAll(): Promise<void> {
    const { clearAllData } = await import("../storage/unifiedDB");
    await clearAllData();
  }
}

export const libraryPersistence = new LibraryPersistence();
export { LibraryPersistence };
