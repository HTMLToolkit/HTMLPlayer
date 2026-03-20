export type ThemeMode = "light" | "dark" | "auto";
export type RepeatMode = "off" | "one" | "all";
export type CrossfadeShape = "none" | "linear" | "equalpower";

export interface SettingsState {
  volume: number;
  crossfade: number;
  crossfadeBeforeGapless: number;
  colorTheme: string;
  wallpaper: string;
  defaultShuffle: boolean;
  defaultRepeat: RepeatMode;
  autoPlayNext: boolean;
  themeMode: ThemeMode;
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
  sessionRestore: boolean;
  lastPlayedSongId?: string;
  lastPlayedPlaylistId?: string;
  language: string;
  tempo: number;
  pitch: number;
  gaplessPlayback: boolean;
  smartShuffle: boolean;
  discordUserId?: string;
  discordEnabled: boolean;
  erudaEnabled: boolean;
}

export interface SettingsActions {
  setVolume(volume: number): void;
  setCrossfade(duration: number): void;
  setColorTheme(theme: string): void;
  setWallpaper(wallpaper: string): void;
  setDefaultShuffle(shuffle: boolean): void;
  setDefaultRepeat(repeat: RepeatMode): void;
  setAutoPlayNext(autoPlay: boolean): void;
  setThemeMode(mode: ThemeMode): void;
  setCompactMode(compact: boolean): void;
  setShowAlbumArt(show: boolean): void;
  setShowLyrics(show: boolean): void;
  setSessionRestore(restore: boolean): void;
  setLastPlayed(songId: string, playlistId?: string): void;
  setLanguage(language: string): void;
  setTempo(tempo: number): void;
  setPitch(pitch: number): void;
  setGaplessPlayback(enabled: boolean): void;
  setSmartShuffle(enabled: boolean): void;
  setDiscordEnabled(enabled: boolean): void;
  setDiscordUserId(userId: string): void;
  setErudaEnabled(enabled: boolean): void;
  updateSettings(updates: Partial<SettingsState>): void;
  resetToDefaults(): void;
}

export interface SettingsEvents {
  on(
    event: "settingschange",
    callback: (settings: Partial<SettingsState>) => void,
  ): void;
  on(event: "themechange", callback: (theme: string) => void): void;
  on(event: "wallpaperchange", callback: (wallpaper: string) => void): void;
}

export type SettingsEventType = keyof SettingsEvents;

export interface SettingsEventMap {
  settingschange: Partial<SettingsState>;
  themechange: string;
  wallpaperchange: string;
}

export const DEFAULT_SETTINGS: SettingsState = {
  volume: 1,
  crossfade: 0,
  crossfadeBeforeGapless: 3000,
  colorTheme: "Blue",
  wallpaper: "none",
  defaultShuffle: false,
  defaultRepeat: "off",
  autoPlayNext: true,
  themeMode: "dark",
  compactMode: false,
  showAlbumArt: true,
  showLyrics: false,
  sessionRestore: true,
  language: "en",
  tempo: 1,
  pitch: 0,
  gaplessPlayback: true,
  smartShuffle: true,
  discordEnabled: false,
  erudaEnabled: false,
};
