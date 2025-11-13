interface PlayerSettings {
  volume: number;
  crossfade: number;
  crossfadeBeforeGapless?: number; // Stores the crossfade value before gapless was enabled
  colorTheme: string;
  wallpaper: string;
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
  pitch: number; // Pitch shift in semitones, default: 0
  gaplessPlayback: boolean;
  smartShuffle: boolean;
  discordUserId?: string;
  discordEnabled: boolean;
  erudaEnabled: boolean;
  playHistory?: [string, { lastPlayed: number; playCount: number }][];
}
