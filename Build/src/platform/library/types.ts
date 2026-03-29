import type {
  Track,
  Playlist,
  PlaylistItem,
  PlaylistFolder,
} from "../../core/engine/types";

export interface LibraryState {
  songs: Track[];
  playlists: PlaylistItem[];
  favorites: string[];
  searchQuery: string;
}

export interface LibraryActions {
  addSong(song: Track): void;
  removeSong(songId: string): void;
  updateSong(songId: string, updates: Partial<Track>): void;
  addPlaylist(playlist: Playlist): void;
  removePlaylist(playlistId: string): void;
  updatePlaylist(playlistId: string, updates: Partial<Playlist>): void;
  addToPlaylist(playlistId: string, song: Track): void;
  removeFromPlaylist(playlistId: string, songId: string): void;
  reorderPlaylistSongs(playlistId: string, songs: Track[]): void;
  createFolder(name: string): PlaylistFolder;
  moveToFolder(playlistId: string, folderId: string): void;
  toggleFavorite(songId: string): void;
  isFavorite(songId: string): boolean;
  search(query: string): Track[];
  getSongsByArtist(artist: string): Track[];
  getSongsByAlbum(album: string): Track[];
  getFavoriteSongs(): Track[];
  clearLibrary(): void;
}

export interface LibraryEvents {
  on(event: "songadded", callback: (song: Track) => void): void;
  on(event: "songremoved", callback: (songId: string) => void): void;
  on(event: "playlistadded", callback: (playlist: Playlist) => void): void;
  on(event: "playlistremoved", callback: (playlistId: string) => void): void;
  on(
    event: "favoritechanged",
    callback: (songId: string, isFavorite: boolean) => void,
  ): void;
  on(event: "librarycleared", callback: () => void): void;
}

export type LibraryEventType = keyof LibraryEvents;

export interface LibraryEventMap {
  songadded: Track;
  songremoved: string;
  playlistadded: Playlist;
  playlistremoved: string;
  favoritechanged: { songId: string; isFavorite: boolean };
  librarycleared: null;
}

export interface PlaylistOperations {
  create(name: string, songs?: Track[]): Playlist;
  duplicate(playlistId: string): Playlist | null;
  merge(playlistIds: string[]): Playlist | null;
  exportToJSON(playlistId: string): string;
  importFromJSON(json: string): Playlist;
}

export interface ScanOptions {
  recursive: boolean;
  supportedFormats: string[];
  extractMetadata: boolean;
  extractAlbumArt: boolean;
}
