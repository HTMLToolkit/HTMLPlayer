import type {
  Track,
  Playlist,
  PlaylistFolder,
  PlaylistItem,
} from "../../core/engine/types";
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

    for (const playlist of flattenPlaylists(this.state.playlists)) {
      playlist.songs = playlist.songs.filter((s) => s.id !== songId);
    }

    this.emit("songremoved", songId);
  }

  updateSong(songId: string, updates: Partial<Track>): void {
    const index = this.state.songs.findIndex((s) => s.id === songId);
    if (index === -1) return;

    this.state.songs[index] = { ...this.state.songs[index]!, ...updates }; // index !== -1 checked above, so songs[index] is set
    this.emit("songupdated", this.state.songs[index]!); // just assigned on the line above
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
    const removed = this.removeFromTree(this.state.playlists, playlistId);
    if (removed && "songs" in removed) {
      this.emit("playlistremoved", playlistId);
    }
  }

  updatePlaylist(playlistId: string, updates: Partial<Playlist>): void {
    const node = this.findItem(this.state.playlists, playlistId);
    if (!node || !("songs" in node.item)) return;

    const updated = { ...node.item, ...updates };
    node.parent[node.index] = updated;
    this.emit("playlistupdated", updated);
  }

  getPlaylist(playlistId: string): Playlist | undefined {
    const node = this.findItem(this.state.playlists, playlistId);
    if (node && "songs" in node.item) {
      return node.item;
    }
    return undefined;
  }

  addToPlaylist(playlistId: string, song: Track): void {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return;

    const exists = playlist.songs.some((s) => s.id === song.id);
    if (exists) return;

    playlist.songs.push(song);
    this.emit("playlistupdated", playlist);
  }

  removeFromPlaylist(playlistId: string, songId: string): void {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return;

    playlist.songs = playlist.songs.filter((s) => s.id !== songId);
    this.emit("playlistupdated", playlist);
  }

  reorderPlaylistSongs(playlistId: string, songs: Track[]): void {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return;

    playlist.songs = songs;
    this.emit("playlistupdated", playlist);
  }

  createFolder(name: string): PlaylistFolder {
    const folder: PlaylistFolder = {
      id: this.generateId(),
      name,
      children: [],
    };
    this.state.playlists.push(folder);
    this.emit("playlistsupdated", [...this.state.playlists]);
    return folder;
  }

  removeFolder(folderId: string): void {
    const removed = this.removeFromTree(this.state.playlists, folderId);
    if (removed) {
      this.emit("playlistsupdated", [...this.state.playlists]);
    }
  }

  renameFolder(folderId: string, name: string): void {
    const node = this.findItem(this.state.playlists, folderId);
    if (node && "children" in node.item) {
      node.item.name = name;
      this.emit("playlistsupdated", [...this.state.playlists]);
    }
  }

  moveToFolder(playlistId: string, folderId: string): void {
    this.moveItem(playlistId, folderId);
  }

  moveFolder(folderId: string, targetFolderId: string): void {
    this.moveItem(folderId, targetFolderId);
  }

  seedPlaylists(items: PlaylistItem[]): void {
    this.state.playlists = items;
  }

  private findItem(
    items: PlaylistItem[],
    id: string,
  ): { parent: PlaylistItem[]; index: number; item: PlaylistItem } | null {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === undefined) continue;
      if (item.id === id) {
        return { parent: items, index: i, item };
      }
      if ("children" in item) {
        const found = this.findItem(item.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  private removeFromTree(
    items: PlaylistItem[],
    id: string,
  ): PlaylistItem | null {
    const node = this.findItem(items, id);
    if (!node) return null;
    node.parent.splice(node.index, 1);
    return node.item;
  }

  private isDescendant(folder: PlaylistFolder, id: string): boolean {
    for (const child of folder.children) {
      if (child.id === id) return true;
      if ("children" in child && this.isDescendant(child, id)) return true;
    }
    return false;
  }

  private moveItem(itemId: string, targetFolderId: string): void {
    const node = this.findItem(this.state.playlists, itemId);
    if (!node) return;

    if (targetFolderId === "root") {
      node.parent.splice(node.index, 1);
      this.state.playlists.push(node.item);
      this.emit("playlistsupdated", [...this.state.playlists]);
      return;
    }

    const target = this.findItem(this.state.playlists, targetFolderId);
    if (!target || !("children" in target.item)) return;

    if ("children" in node.item && this.isDescendant(node.item, targetFolderId)) {
      return;
    }

    node.parent.splice(node.index, 1);
    target.item.children.push(node.item);
    this.emit("playlistsupdated", [...this.state.playlists]);
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

export function flattenPlaylists(
  items: (Playlist | PlaylistFolder)[],
): Playlist[] {
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
