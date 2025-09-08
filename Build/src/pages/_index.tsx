import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { MainContent } from "../components/MainContent";
import { Player } from "../components/Player";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import {
  switchToAutoMode,
  switchToDarkMode,
  switchToLightMode,
  ThemeMode,
} from "../helpers/themeMode";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import styles from "./_index.module.css";
import { useMusicLibrary } from "../hooks/useMusicLibrary";
import { useSearchAndNavigation } from "../hooks/useSearchAndNavigation";

export default function IndexPage() {
  const audioPlayback = useAudioPlayback();
  const musicLibrary = useMusicLibrary();
  const searchAndNavigation = useSearchAndNavigation();

  const [, setThemeMode] = useState<ThemeMode>("auto");

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
      <Sidebar musicPlayerHook={ audioPlayback }/>
      <div className={ styles.mainSection }>
        <MainContent audioPlayback={ audioPlayback } musicLibrary={ musicLibrary } searchAndNavigation={ searchAndNavigation } />
        <Player musicPlayerHook={ audioPlayback } settings={{
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
          lastPlayedSongId: undefined,
          lastPlayedPlaylistId: undefined
        }} />
      </div>
    </div>
  );
}
