interface PlayerSettings {
  volume: number;
  crossfade: number;
  colorTheme: string;
  defaultShuffle: boolean;
  defaultRepeat: "off" | "one" | "all";
  autoPlayNext: boolean;
  themeMode: "light" | "dark" | "auto";
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
  sessionRestore: boolean;
  lastPlayedSongId?: string;
  lastPlayedPlaylistId?: string;
  language: string;
  tempo: number;
  gaplessPlayback: boolean;
  smartShuffle: boolean;
  discordUserId?: string;
  discordEnabled: boolean;
  recentlyPlayed?: string[];
}
