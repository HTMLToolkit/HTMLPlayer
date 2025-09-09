import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { MainContent } from "../components/MainContent";
import { Player } from "../components/Player";
import { ErrorBoundary } from "../helpers/errorBoundary";
import {
  switchToAutoMode,
  switchToDarkMode,
  switchToLightMode,
  ThemeMode,
} from "../helpers/themeMode";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import styles from "./_index.module.css";
import { useMusicPlayer } from "../hooks/useMusicPlayer";

export default function IndexPage() {
  const musicPlayer = useMusicPlayer();

  const [, setThemeMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    document.title = "HTMLPlayer";
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
    <ErrorBoundary
      // Pass the complete musicPlayer object instead of individual hooks
      musicPlayer={musicPlayer}
    >
      <div className={styles.container}>
        <Sidebar 
          musicPlayer={musicPlayer}
        />
        <div className={styles.mainSection}>
          <MainContent
            musicPlayer={musicPlayer}
          />
          <Player
            musicPlayer={musicPlayer}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}