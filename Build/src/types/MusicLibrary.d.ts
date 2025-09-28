interface MusicLibrary {
  songs: Song[];
  playlists: (Playlist | PlaylistFolder)[];
  favorites: string[];
}