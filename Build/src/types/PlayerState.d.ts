export type PlayerState = {
  currentSong: Song | null;
  currentPlaylist: Playlist | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  analyserNode: AnalyserNode | null;
  view: "songs" | "artist" | "album";
  currentArtist?: string;
  currentAlbum?: string;
};