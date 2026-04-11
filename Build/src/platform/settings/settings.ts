import type { SettingsState, SettingsEventMap, SettingsActions } from "./types";
import { DEFAULT_SETTINGS } from "./types";

type EventCallback<T> = (data: T) => void;

export class SettingsManager implements SettingsActions {
  private settings: SettingsState;
  private listeners: Map<keyof SettingsEventMap, Set<EventCallback<unknown>>> =
    new Map();

  constructor(initialSettings?: Partial<SettingsState>) {
    this.settings = { ...DEFAULT_SETTINGS, ...initialSettings };
  }

  getSettings(): SettingsState {
    return { ...this.settings };
  }

  setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.emitSettingsChange({ volume: this.settings.volume });
  }

  setCrossfade(duration: number): void {
    this.settings.crossfade = Math.max(0, duration);
    this.emitSettingsChange({ crossfade: this.settings.crossfade });
  }

  setColorTheme(theme: string): void {
    this.settings.colorTheme = theme;
    this.emitSettingsChange({ colorTheme: theme });
    this.emit("themechange", theme);
  }

  setWallpaper(wallpaper: string): void {
    this.settings.wallpaper = wallpaper;
    this.emitSettingsChange({ wallpaper });
    this.emit("wallpaperchange", wallpaper);
  }

  setDefaultShuffle(shuffle: boolean): void {
    this.settings.defaultShuffle = shuffle;
    this.emitSettingsChange({ defaultShuffle: shuffle });
  }

  setDefaultRepeat(repeat: SettingsState["defaultRepeat"]): void {
    this.settings.defaultRepeat = repeat;
    this.emitSettingsChange({ defaultRepeat: repeat });
  }

  setAutoPlayNext(autoPlay: boolean): void {
    this.settings.autoPlayNext = autoPlay;
    this.emitSettingsChange({ autoPlayNext: autoPlay });
  }

  setThemeMode(mode: SettingsState["themeMode"]): void {
    this.settings.themeMode = mode;
    this.emitSettingsChange({ themeMode: mode });
  }

  setCompactMode(compact: boolean): void {
    this.settings.compactMode = compact;
    this.emitSettingsChange({ compactMode: compact });
  }

  setShowAlbumArt(show: boolean): void {
    this.settings.showAlbumArt = show;
    this.emitSettingsChange({ showAlbumArt: show });
  }

  setShowLyrics(show: boolean): void {
    this.settings.showLyrics = show;
    this.emitSettingsChange({ showLyrics: show });
  }

  setSessionRestore(restore: boolean): void {
    this.settings.sessionRestore = restore;
    this.emitSettingsChange({ sessionRestore: restore });
  }

  setLastPlayed(songId: string, playlistId?: string): void {
    this.settings.lastPlayedSongId = songId;
    this.settings.lastPlayedPlaylistId = playlistId;
    this.emitSettingsChange({
      lastPlayedSongId: songId,
      lastPlayedPlaylistId: playlistId,
    });
  }

  setLanguage(language: string): void {
    this.settings.language = language;
    this.emitSettingsChange({ language });
  }

  setTempo(tempo: number): void {
    this.settings.tempo = Math.max(0.25, Math.min(4, tempo));
    this.emitSettingsChange({ tempo: this.settings.tempo });
  }

  setPitch(pitch: number): void {
    this.settings.pitch = Math.max(-12, Math.min(12, pitch));
    this.emitSettingsChange({ pitch: this.settings.pitch });
  }

  setGaplessPlayback(enabled: boolean): void {
    this.settings.gaplessPlayback = enabled;
    this.emitSettingsChange({ gaplessPlayback: enabled });
  }

  setSmartShuffle(enabled: boolean): void {
    this.settings.smartShuffle = enabled;
    this.emitSettingsChange({ smartShuffle: enabled });
  }

  setDiscordEnabled(enabled: boolean): void {
    this.settings.discordEnabled = enabled;
    this.emitSettingsChange({ discordEnabled: enabled });
  }

  setDiscordUserId(userId: string): void {
    this.settings.discordUserId = userId;
    this.emitSettingsChange({ discordUserId: userId });
  }

  setErudaEnabled(enabled: boolean): void {
    this.settings.erudaEnabled = enabled;
    this.emitSettingsChange({ erudaEnabled: enabled });
  }

  updateSettings(updates: Partial<SettingsState>): void {
    const validUpdates: Partial<SettingsState> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key in this.settings) {
        (this.settings as unknown as Record<string, unknown>)[key] = value;
        (validUpdates as unknown as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(validUpdates).length > 0) {
      this.emitSettingsChange(validUpdates);
    }
  }

  resetToDefaults(): void {
    const previousSettings = { ...this.settings };
    this.settings = { ...DEFAULT_SETTINGS };

    const changes: Partial<SettingsState> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as Array<
      keyof SettingsState
    >) {
      if (previousSettings[key] !== DEFAULT_SETTINGS[key]) {
        (changes as unknown as Record<string, unknown>)[key] =
          DEFAULT_SETTINGS[key];
      }
    }

    if (Object.keys(changes).length > 0) {
      this.emitSettingsChange(changes);
    }
  }

  on<K extends keyof SettingsEventMap>(
    event: K,
    callback: EventCallback<SettingsEventMap[K]>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  off<K extends keyof SettingsEventMap>(
    event: K,
    callback: EventCallback<SettingsEventMap[K]>,
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  private emitSettingsChange(changes: Partial<SettingsState>): void {
    this.emit("settingschange", changes);
  }

  private emit<K extends keyof SettingsEventMap>(
    event: K,
    data: SettingsEventMap[K],
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }
}
