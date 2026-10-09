import type { Track, PlaylistItem } from "../../core/engine/types";
import type { LibraryState } from "./types";
import { trackStorage } from "../storage/trackStorage";
import { playlistStorage, favoritesStorage } from "../storage/playlistStorage";

class LibraryPersistence {
  async saveSong(song: Track): Promise<void> {
    await trackStorage.saveTrack(song);
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
}

export const libraryPersistence = new LibraryPersistence();
export { LibraryPersistence };
