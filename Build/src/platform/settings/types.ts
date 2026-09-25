export type ThemeMode = "light" | "dark" | "auto";
export type RepeatMode = "off" | "one" | "all";
export type CrossfadeShape = "none" | "linear" | "equalpower";

export interface SettingsState {
  colorTheme: string;
  wallpaper: string;
  themeMode: ThemeMode;
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
  sessionRestore: boolean;
  lastPlayedSongId?: string;
  lastPlayedPlaylistId?: string;
  language: string;
  discordUserId?: string;
  discordEnabled: boolean;
  erudaEnabled: boolean;
}

export interface SettingsActions {
  setColorTheme(theme: string): void;
  setWallpaper(wallpaper: string): void;
  setThemeMode(mode: ThemeMode): void;
  setCompactMode(compact: boolean): void;
  setShowAlbumArt(show: boolean): void;
  setShowLyrics(show: boolean): void;
  setSessionRestore(restore: boolean): void;
  setLastPlayed(songId: string, playlistId?: string): void;
  setLanguage(language: string): void;
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
  colorTheme: "Blue",
  wallpaper: "none",
  themeMode: "auto",
  compactMode: false,
  showAlbumArt: true,
  showLyrics: false,
  sessionRestore: true,
  language: "en",
  discordEnabled: false,
  erudaEnabled: false,
};
