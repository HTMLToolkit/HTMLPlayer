import { SettingsManager } from "../src/platform/settings/settings";
import type { SettingsState } from "../src/platform/settings/types";

describe("SettingsManager", () => {
  let settings: SettingsManager;

  beforeEach(() => {
    settings = new SettingsManager();
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

  describe("Eruda", () => {
    it("should set eruda enabled", () => {
      settings.setErudaEnabled(true);
      expect(settings.getSettings().erudaEnabled).toBe(true);
    });
  });

  describe("updateSettings", () => {
    it("should update multiple settings at once", () => {
      settings.updateSettings({
        themeMode: "dark",
        compactMode: true,
        showLyrics: true,
      });
      const result = settings.getSettings();
      expect(result.themeMode).toBe("dark");
      expect(result.compactMode).toBe(true);
      expect(result.showLyrics).toBe(true);
    });

    it("should ignore unknown keys", () => {
      settings.updateSettings({
        compactMode: true,
        unknownKey: "test",
      } as unknown as Partial<SettingsState>);
      expect(settings.getSettings().compactMode).toBe(true);
    });
  });

  describe("resetToDefaults", () => {
    it("should reset all settings to defaults", () => {
      settings.setColorTheme("Red");
      settings.setCompactMode(true);
      settings.setShowLyrics(true);
      settings.setDiscordEnabled(true);
      settings.setErudaEnabled(true);

      settings.resetToDefaults();

      const result = settings.getSettings();
      expect(result.colorTheme).toBe("Blue");
      expect(result.compactMode).toBe(false);
      expect(result.showLyrics).toBe(false);
      expect(result.discordEnabled).toBe(false);
      expect(result.erudaEnabled).toBe(false);
    });

    it("should emit settingschange on reset", () => {
      settings.setShowLyrics(true);
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
      settings.setShowLyrics(true);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});