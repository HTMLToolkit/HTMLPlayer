type Playlist = {
  id: string;
  name: string;
  songs: Song[];
};

type PlaylistFolder = {
  id: string;
  name: string;
  children: (Playlist | PlaylistFolder)[];
};
