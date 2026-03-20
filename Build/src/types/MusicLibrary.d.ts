import type { Track, Playlist, PlaylistFolder } from "../core/engine/types";

declare global {
  interface MusicLibrary {
    songs: Track[];
    playlists: (Playlist | PlaylistFolder)[];
    favorites: string[];
  }
}
