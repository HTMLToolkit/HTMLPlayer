import { SettingsManager } from "../src/platform/settings/settings";
import type { SettingsState } from "../src/platform/settings/types";

describe("SettingsManager", () => {
  let settings: SettingsManager;

  beforeEach(() => {
    settings = new SettingsManager();
  });

  describe("Volume", () => {
    it("should set volume", () => {
      settings.setVolume(0.5);
      expect(settings.getSettings().volume).toBe(0.5);
    });

    it("should clamp volume to 0-1", () => {
      settings.setVolume(1.5);
      expect(settings.getSettings().volume).toBe(1);

      settings.setVolume(-0.5);
      expect(settings.getSettings().volume).toBe(0);
    });

    it("should emit settingschange", () => {
      const callback = jest.fn();
      settings.on("settingschange", callback);
      settings.setVolume(0.8);
      expect(callback).toHaveBeenCalledWith({ volume: 0.8 });
    });
  });

  describe("Crossfade", () => {
    it("should set crossfade duration", () => {
      settings.setCrossfade(3000);
      expect(settings.getSettings().crossfade).toBe(3000);
    });

    it("should not allow negative crossfade", () => {
      settings.setCrossfade(-100);
      expect(settings.getSettings().crossfade).toBe(0);
    });
  });

  describe("Theme", () => {
    it("should set color theme", () => {
      settings.setColorTheme("Obsidian");
      expect(settings.getSettings().colorTheme).toBe("Obsidian");
    });

    it("should emit themechange event", () => {
      const callback = jest.fn();
      settings.on("themechange", callback);
      settings.setColorTheme("Blue");
      expect(callback).toHaveBeenCalledWith("Blue");
    });

    it("should set wallpaper", () => {
      settings.setWallpaper("particles");
      expect(settings.getSettings().wallpaper).toBe("particles");
    });

    it("should emit wallpaperchange event", () => {
      const callback = jest.fn();
      settings.on("wallpaperchange", callback);
      settings.setWallpaper("geometric");
      expect(callback).toHaveBeenCalledWith("geometric");
    });
  });

  describe("Playback settings", () => {
    it("should set default shuffle", () => {
      settings.setDefaultShuffle(true);
      expect(settings.getSettings().defaultShuffle).toBe(true);
    });

    it("should set default repeat", () => {
      settings.setDefaultRepeat("all");
      expect(settings.getSettings().defaultRepeat).toBe("all");
    });

    it("should set auto play next", () => {
      settings.setAutoPlayNext(false);
      expect(settings.getSettings().autoPlayNext).toBe(false);
    });

    it("should set gapless playback", () => {
      settings.setGaplessPlayback(true);
      expect(settings.getSettings().gaplessPlayback).toBe(true);
    });

    it("should set smart shuffle", () => {
      settings.setSmartShuffle(false);
      expect(settings.getSettings().smartShuffle).toBe(false);
    });
  });

  describe("Tempo and Pitch", () => {
    it("should clamp tempo", () => {
      settings.setTempo(5);
      expect(settings.getSettings().tempo).toBe(4);

      settings.setTempo(0.1);
      expect(settings.getSettings().tempo).toBe(0.25);
    });

    it("should clamp pitch to -12 to 12 semitones", () => {
      settings.setPitch(20);
      expect(settings.getSettings().pitch).toBe(12);

      settings.setPitch(-20);
      expect(settings.getSettings().pitch).toBe(-12);
    });
  });

  describe("UI settings", () => {
    it("should set theme mode", () => {
      settings.setThemeMode("light");
      expect(settings.getSettings().themeMode).toBe("light");
    });

    it("should set compact mode", () => {
      settings.setCompactMode(true);
      expect(settings.getSettings().compactMode).toBe(true);
    });

    it("should set show album art", () => {
      settings.setShowAlbumArt(false);
      expect(settings.getSettings().showAlbumArt).toBe(false);
    });

    it("should set show lyrics", () => {
      settings.setShowLyrics(true);
      expect(settings.getSettings().showLyrics).toBe(true);
    });

    it("should set session restore", () => {
      settings.setSessionRestore(false);
      expect(settings.getSettings().sessionRestore).toBe(false);
    });
  });

  describe("Language and localization", () => {
    it("should set language", () => {
      settings.setLanguage("fr");
      expect(settings.getSettings().language).toBe("fr");
    });
  });

  describe("Last played", () => {
    it("should set last played song and playlist", () => {
      settings.setLastPlayed("song-123", "playlist-456");
      const result = settings.getSettings();
      expect(result.lastPlayedSongId).toBe("song-123");
      expect(result.lastPlayedPlaylistId).toBe("playlist-456");
    });

    it("should set last played song only", () => {
      settings.setLastPlayed("song-123");
      const result = settings.getSettings();
      expect(result.lastPlayedSongId).toBe("song-123");
    });
  });

  describe("Discord", () => {
    it("should set discord enabled", () => {
      settings.setDiscordEnabled(true);
      expect(settings.getSettings().discordEnabled).toBe(true);
    });

    it("should set discord user ID", () => {
      settings.setDiscordUserId("user-123");
      expect(settings.getSettings().discordUserId).toBe("user-123");
    });
  });

  describe("updateSettings", () => {
    it("should update multiple settings at once", () => {
      settings.updateSettings({
        volume: 0.9,
        crossfade: 5000,
        pitch: 2,
      });
      const result = settings.getSettings();
      expect(result.volume).toBe(0.9);
      expect(result.crossfade).toBe(5000);
      expect(result.pitch).toBe(2);
    });

    it("should ignore unknown keys", () => {
      settings.updateSettings({ volume: 0.5, unknownKey: "test" } as unknown as Partial<SettingsState>);
      expect(settings.getSettings().volume).toBe(0.5);
    });
  });

  describe("resetToDefaults", () => {
    it("should reset all settings to defaults", () => {
      settings.setVolume(0.9);
      settings.setColorTheme("Red");
      settings.setPitch(5);
      settings.setSmartShuffle(false);
      
      settings.resetToDefaults();
      
      const result = settings.getSettings();
      expect(result.volume).toBe(1);
      expect(result.colorTheme).toBe("Obsidian");
      expect(result.pitch).toBe(0);
      expect(result.smartShuffle).toBe(true);
    });

    it("should emit settingschange on reset", () => {
      settings.setVolume(0.5);
      const callback = jest.fn();
      settings.on("settingschange", callback);
      settings.resetToDefaults();
      expect(callback).toHaveBeenCalled();
    });
  });

  describe("Event handling", () => {
    it("should remove event listener", () => {
      const callback = jest.fn();
      settings.on("settingschange", callback);
      settings.off("settingschange", callback);
      settings.setVolume(0.5);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});