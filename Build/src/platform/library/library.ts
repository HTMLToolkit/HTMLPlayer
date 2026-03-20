import type { Track, Playlist, PlaylistFolder } from "../../core/engine/types";
import type { LibraryState, LibraryEventMap, LibraryActions } from "./types";

type EventCallback<T> = (data: T) => void;

export class LibraryManager implements LibraryActions {
  private state: LibraryState = {
    songs: [],
    playlists: [],
    favorites: [],
    searchQuery: "",
  };

  private listeners: Map<keyof LibraryEventMap, Set<EventCallback<unknown>>> =
    new Map();

  constructor(initialState?: Partial<LibraryState>) {
    if (initialState) {
      this.state = { ...this.state, ...initialState };
    }
  }

  getState(): LibraryState {
    return {
      ...this.state,
      songs: [...this.state.songs],
      playlists: [...this.state.playlists],
      favorites: [...this.state.favorites],
    };
  }

  addSong(song: Track): void {
    const exists = this.state.songs.some((s) => s.id === song.id);
    if (exists) return;

    this.state.songs.push(song);
    this.emit("songadded", song);
  }

  removeSong(songId: string): void {
    const index = this.state.songs.findIndex((s) => s.id === songId);
    if (index === -1) return;

    this.state.songs.splice(index, 1);
    this.state.favorites = this.state.favorites.filter((id) => id !== songId);

    for (const item of this.state.playlists) {
      if ("songs" in item) {
        item.songs = item.songs.filter((s) => s.id !== songId);
      }
    }

    this.emit("songremoved", songId);
  }

  updateSong(songId: string, updates: Partial<Track>): void {
    const index = this.state.songs.findIndex((s) => s.id === songId);
    if (index === -1) return;

    this.state.songs[index] = { ...this.state.songs[index], ...updates };
  }

  getSong(songId: string): Track | undefined {
    return this.state.songs.find((s) => s.id === songId);
  }

  addPlaylist(playlist: Playlist): void {
    const exists = this.state.playlists.some(
      (p) => "id" in p && p.id === playlist.id,
    );
    if (exists) return;

    this.state.playlists.push(playlist);
    this.emit("playlistadded", playlist);
  }

  removePlaylist(playlistId: string): void {
    const index = this.state.playlists.findIndex(
      (p) => "id" in p && p.id === playlistId,
    );
    if (index === -1) return;

    this.state.playlists.splice(index, 1);
    this.emit("playlistremoved", playlistId);
  }

  updatePlaylist(playlistId: string, updates: Partial<Playlist>): void {
    const index = this.state.playlists.findIndex(
      (p) => "id" in p && p.id === playlistId,
    );
    if (index === -1) return;

    const playlist = this.state.playlists[index];
    if ("songs" in playlist) {
      this.state.playlists[index] = { ...playlist, ...updates } as Playlist;
    }
  }

  getPlaylist(playlistId: string): Playlist | undefined {
    const item = this.state.playlists.find(
      (p) => "id" in p && p.id === playlistId,
    );
    if (item && "songs" in item) {
      return item;
    }
    return undefined;
  }

  addToPlaylist(playlistId: string, song: Track): void {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return;

    const exists = playlist.songs.some((s) => s.id === song.id);
    if (exists) return;

    playlist.songs.push(song);
  }

  removeFromPlaylist(playlistId: string, songId: string): void {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return;

    playlist.songs = playlist.songs.filter((s) => s.id !== songId);
  }

  reorderPlaylistSongs(playlistId: string, songs: Track[]): void {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return;

    playlist.songs = songs;
  }

  createFolder(name: string): PlaylistFolder {
    const folder: PlaylistFolder = {
      id: this.generateId(),
      name,
      children: [],
    };
    this.state.playlists.push(folder);
    return folder;
  }

  moveToFolder(playlistId: string, folderId: string): void {
    const playlistIndex = this.state.playlists.findIndex(
      (p) => "id" in p && p.id === playlistId,
    );
    if (playlistIndex === -1) return;

    const playlist = this.state.playlists[playlistIndex];

    if (folderId === "root") {
      return;
    }

    const folderIndex = this.state.playlists.findIndex(
      (p) => "children" in p && "id" in p && p.id === folderId,
    );
    if (folderIndex === -1) return;

    const folder = this.state.playlists[folderIndex];
    if (!("children" in folder)) return;

    folder.children.push(playlist as Playlist);
    this.state.playlists.splice(playlistIndex, 1);
  }

  toggleFavorite(songId: string): void {
    const index = this.state.favorites.indexOf(songId);
    if (index === -1) {
      this.state.favorites.push(songId);
      this.emit("favoritechanged", { songId, isFavorite: true });
    } else {
      this.state.favorites.splice(index, 1);
      this.emit("favoritechanged", { songId, isFavorite: false });
    }
  }

  isFavorite(songId: string): boolean {
    return this.state.favorites.includes(songId);
  }

  setSearchQuery(query: string): void {
    this.state.searchQuery = query;
  }

  search(query: string): Track[] {
    if (!query.trim()) {
      return [...this.state.songs];
    }

    const lowerQuery = query.toLowerCase();
    return this.state.songs.filter(
      (song) =>
        song.title.toLowerCase().includes(lowerQuery) ||
        song.artist.toLowerCase().includes(lowerQuery) ||
        song.album.toLowerCase().includes(lowerQuery),
    );
  }

  getSongsByArtist(artist: string): Track[] {
    return this.state.songs.filter(
      (song) => song.artist.toLowerCase() === artist.toLowerCase(),
    );
  }

  getSongsByAlbum(album: string): Track[] {
    return this.state.songs.filter(
      (song) => song.album.toLowerCase() === album.toLowerCase(),
    );
  }

  getFavoriteSongs(): Track[] {
    return this.state.songs.filter((song) =>
      this.state.favorites.includes(song.id),
    );
  }

  getAllArtists(): string[] {
    const artists = new Set<string>();
    for (const song of this.state.songs) {
      artists.add(song.artist);
    }
    return Array.from(artists).sort();
  }

  getAllAlbums(): string[] {
    const albums = new Set<string>();
    for (const song of this.state.songs) {
      albums.add(song.album);
    }
    return Array.from(albums).sort();
  }

  clearLibrary(): void {
    this.state = {
      songs: [],
      playlists: [],
      favorites: [],
      searchQuery: "",
    };
    this.emit("librarycleared", null);
  }

  on<K extends keyof LibraryEventMap>(
    event: K,
    callback: EventCallback<LibraryEventMap[K]>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  off<K extends keyof LibraryEventMap>(
    event: K,
    callback: EventCallback<LibraryEventMap[K]>,
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  private emit<K extends keyof LibraryEventMap>(
    event: K,
    data: LibraryEventMap[K],
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  private generateId(): string {
    return `lib-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export function flattenPlaylists(items: (Playlist | PlaylistFolder)[]): Playlist[] {
  const result: Playlist[] = [];
  for (const item of items) {
    if ("songs" in item) {
      result.push(item);
    } else if (item.children?.length) {
      result.push(...flattenPlaylists(item.children));
    }
  }
  return result;
}

export function findPlaylistById(
  items: (Playlist | PlaylistFolder)[],
  id: string,
): Playlist | null {
  for (const item of items) {
    if (item.id === id && "songs" in item) {
      return item;
    }
    if ("children" in item) {
      const found = findPlaylistById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findParentFolderId(
  items: (Playlist | PlaylistFolder)[],
  id: string,
): string | null {
  for (const item of items) {
    if (item.id === id) return null;
    if ("children" in item) {
      for (const child of item.children) {
        if (child.id === id) return item.id;
        if ("children" in child) {
          const found = findParentFolderId(item.children, id);
          if (found) return found;
        }
      }
    }
  }
  return null;
}
