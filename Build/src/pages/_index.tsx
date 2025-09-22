import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { MainContent } from "../components/MainContent";
import { Player } from "../components/Player";
import { useMusicPlayer } from "../hooks/musicPlayerHook";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import {
  switchToAutoMode,
  switchToDarkMode,
  switchToLightMode,
  ThemeMode,
} from "../helpers/themeMode";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import styles from "./_index.module.css";

export default function IndexPage() {
  const musicPlayerHook = useMusicPlayer();
  const [, setThemeMode] = useState<ThemeMode>("auto");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initialize keyboard shortcuts with the new hook
  const { reloadShortcuts } = useKeyboardShortcuts({
    musicPlayerHook,
    onOpenSettings: () => {
      setSettingsOpen(!settingsOpen);
    },
    onToggleLyrics: () => {
      // Toggle lyrics visibility in player settings
      const currentSettings = musicPlayerHook.settings;
      musicPlayerHook.updateSettings({ 
        showLyrics: !currentSettings.showLyrics 
      });
    },
    onToggleVisualizer: () => {
      // Toggle visualizer (this might need to be implemented differently)
      // For now, just log as the visualizer system might not be fully set up
      console.log('Toggle visualizer shortcut - implementation needed');
    },
    onSearch: () => {
      // Focus search input if it exists
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  useEffect(() => {
    // Set the document title
    document.title = "HTMLPlayer";

    // Set the meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "A modern music player interface with playlists, song management, and an amazing visualizer."
      );
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content =
        "A modern music player interface with playlists, song management, and an amazing visualizer.";
      document.head.appendChild(meta);
    }

    async function loadThemeMode() {
      const settings = await musicIndexedDbHelper.loadSettings();
      const mode = settings?.themeMode || "auto";
      setThemeMode(mode);

      switch (mode) {
        case "light":
          switchToLightMode();
          break;
        case "dark":
          switchToDarkMode();
          break;
        case "auto":
        default:
          switchToAutoMode();
          break;
      }
    }

    loadThemeMode();
  }, []);

  return (
    <div className={styles.container}>
      <Sidebar 
        musicPlayerHook={musicPlayerHook} 
        onShortcutsChanged={reloadShortcuts}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />
      <div className={styles.mainSection}>
        <MainContent musicPlayerHook={musicPlayerHook} />
        <Player musicPlayerHook={musicPlayerHook} settings={{
          volume: 0,
          crossfade: 0,
          defaultShuffle: false,
          defaultRepeat: "off",
          themeMode: "light",
          colorTheme: "",
          autoPlayNext: false,
          compactMode: false,
          showAlbumArt: false,
          showLyrics: false,
          sessionRestore: true,
          gaplessPlayback: true,
          smartShuffle: true,
          lastPlayedSongId: undefined,
          lastPlayedPlaylistId: undefined,
          language: "English",
          tempo: 1,
          discordEnabled: false
        }} />
      </div>
    </div>
  );
}
