import { useState, useRef, useCallback, useEffect } from "react";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { PlayerSettings } from "../types/PlayerSettings";
import { isInitialized } from "./useMusicLibrary";

export const usePlayerSettings = () => {
  const [settings, setSettings] = useState<PlayerSettings>({
    volume: 0.75,
    crossfade: 3,
    colorTheme: "Blue",
    defaultShuffle: false,
    defaultRepeat: "off",
    autoPlayNext: true,
    themeMode: "auto",
    compactMode: false,
    showAlbumArt: true,
    showLyrics: false,
    lastPlayedSongId: "none",
    lastPlayedPlaylistId: "none",
  });

  const settingsRef = useRef(settings);

  const updateSettings = useCallback((newSettings: Partial<PlayerSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const saveSettings = async () => {
      try {
        await musicIndexedDbHelper.saveSettings(settings);
      } catch (error) {
        console.error("Failed to persist settings:", error);
      }
    };
    saveSettings();
  }, [settings, isInitialized]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  return {
    settings,
    updateSettings,
    usePlayerSettings,
    settingsRef,
    setSettings,
  };
};
