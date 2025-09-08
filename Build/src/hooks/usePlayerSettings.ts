import { useState, useRef, useCallback, useEffect } from "react";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { PlayerSettings } from "../types/PlayerSettings";
import { useMusicLibrary } from "./useMusicLibrary";

export const usePlayerSettings = () => {
  const musicLibrary = useMusicLibrary();

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
    if (!musicLibrary.isInitialized) return;
    const saveSettings = async () => {
      try {
        await musicIndexedDbHelper.saveSettings(settings);
      } catch (error) {
        console.error("Failed to persist settings:", error);
      }
    };
    saveSettings();
  }, [settings, musicLibrary.isInitialized]);

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
