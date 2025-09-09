import { useCallback, useEffect, useRef, useState } from "react";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { PlayerSettings } from "../types/PlayerSettings";
import { debounce } from "lodash";

export const usePlayerSettings = () => {
  const instantiationRef = useRef(false);
  if (instantiationRef.current) {
    console.warn("usePlayerSettings: Attempted re-instantiation, preventing loop");
    throw new Error("Preventing recursive usePlayerSettings instantiation");
  }
  instantiationRef.current = true;
  console.log("usePlayerSettings: Instantiated");

  const [isInitialized, setIsInitialized] = useState(false);
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

  const debouncedSaveSettings = useCallback(
    debounce(async (newSettings: PlayerSettings) => {
      console.log("usePlayerSettings: Saving settings to IndexedDB", newSettings);
      try {
        await musicIndexedDbHelper.saveSettings(newSettings);
      } catch (error) {
        console.error("usePlayerSettings: Failed to save settings:", error);
      }
    }, 100),
    []
  );

  const updateSettings = useCallback(
    (newSettings: Partial<PlayerSettings>) => {
      console.log("usePlayerSettings: updateSettings called", newSettings);
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        settingsRef.current = updated;
        if (isInitialized) {
          debouncedSaveSettings(updated);
        }
        return updated;
      });
    },
    [isInitialized, debouncedSaveSettings]
  );

  useEffect(() => {
    console.log("usePlayerSettings: Initialization useEffect triggered");
    const loadSettings = async () => {
      try {
        const persistedSettings = await musicIndexedDbHelper.loadSettings();
        if (persistedSettings) {
          console.log("usePlayerSettings: Loaded settings", persistedSettings);
          setSettings(persistedSettings);
          settingsRef.current = persistedSettings;
        }
      } catch (error) {
        console.error("usePlayerSettings: Failed to load settings:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    loadSettings();
  }, []);

  return {
    settings,
    updateSettings,
    settingsRef,
    setSettings: updateSettings, // Alias for compatibility
    isInitialized,
  };
};
