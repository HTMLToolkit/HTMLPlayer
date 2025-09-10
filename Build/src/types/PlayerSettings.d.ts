export type PlayerSettings = {
  volume: number;
  crossfade: number;
  colorTheme: string;
  defaultShuffle: boolean;
  defaultRepeat: "off" | "one" | "all";
  themeMode: "light" | "dark" | "auto";
  autoPlayNext: boolean;
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
  lastPlayedSongId?: string;
  lastPlayedPlaylistId?: string;
};