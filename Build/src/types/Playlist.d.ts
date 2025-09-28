interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}

interface PlaylistFolder {
  id: string;
  name: string;
  children: (Playlist | PlaylistFolder)[];
}
