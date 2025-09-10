import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "../global.css";

import { Sidebar } from "../components/Sidebar";
import { MainContent } from "../components/MainContent";
import { Player } from "../components/Player";
import { ErrorBoundary } from "../helpers/errorBoundary";
import { MusicPlayerProvider, useMusicPlayerContext } from "../contexts/musicPlayer";
import { Toaster } from "sonner";
import { ThemeLoader } from "../helpers/themeLoader";
import {
  switchToAutoMode,
  switchToDarkMode,
  switchToLightMode,
  ThemeMode,
} from "../helpers/themeMode";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import styles from "./_index.module.css";

// Inner component that uses the context
function AppContent() {
  const musicPlayer = useMusicPlayerContext();
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

      setThemeMode(prev => (prev === mode ? prev : mode));

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
    <ErrorBoundary musicPlayer={musicPlayer}>
      <div className={styles.container}>
        <Sidebar musicPlayer={musicPlayer} />
        <div className={styles.mainSection}>
          <MainContent musicPlayer={musicPlayer} />
          <Player musicPlayer={musicPlayer} />
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Render everything in one place
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
      <ThemeLoader defaultTheme="Blue">
        <MusicPlayerProvider>
          <Toaster />
          <AppContent />
        </MusicPlayerProvider>
      </ThemeLoader>
  </React.StrictMode>
);
