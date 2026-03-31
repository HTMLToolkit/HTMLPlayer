import type { Track } from "../../core/engine/types";
import type { LibraryState } from "./types";
import { trackStorage } from "../storage/trackStorage";
import { playlistStorage, favoritesStorage } from "../storage/playlistStorage";

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

  async loadFullLibrary(): Promise<LibraryState> {
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
