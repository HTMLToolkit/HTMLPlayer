import { useRef, useEffect, useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Sidebar,
  MainContent,
  Player,
  DraggableProvider,
  HelpGuideProvider,
  WallpaperRenderer,
} from "./components";
import { PlayerRef } from "./components/player/Player";
import { NavigationProvider, useNavigation } from "./navigation";
import { useDragHandler } from "./hooks/useDragHandler";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useFileHandler } from "../hooks/useFileHandler";
import { useShareTarget } from "../hooks/useShareTarget";
import { clearHandledShares } from "../platform/integrations/shareTarget";
import { importAudioFiles } from "../helpers/importAudioFiles";
import { trackStorage } from "../platform/storage/trackStorage";
import {
  switchToAutoMode,
  switchToDarkMode,
  switchToLightMode,
  ThemeMode,
} from "./theming";
import styles from "../pages/_index.module.css";
import type { UseKomorebiReturn } from "../hooks/useKomorebi";

const UpdatePromptComponent = lazy(
  () => import("./components/shared/UpdatePrompt"),
);

interface AppShellProps {
  komorebi: UseKomorebiReturn;
}

function AppShellContent({ komorebi }: AppShellProps) {
  const { t } = useTranslation();
  useNavigation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [, setThemeMode] = useState<ThemeMode>("auto");
  const playerRef = useRef<PlayerRef>(null);

  const handleAddSong = async (song: any, file?: File) => {
    if (!file) return;
    song.url = URL.createObjectURL(file);
    song.hasStoredAudio = true;
    
    const arrayBuffer = await file.arrayBuffer();
    await trackStorage.saveTrack(song, arrayBuffer);
    
    komorebi.addSong(song);
  };

  useFileHandler(handleAddSong, t, importAudioFiles, komorebi.isReady);

  useShareTarget((result) => {
    if (result.files.length > 0) {
      toast.success(
        t("shareTarget.filesReceived", { count: result.files.length }),
      );
      importAudioFiles(result.files, handleAddSong, t).then(() => {
        clearHandledShares();
      });
    }
    if (result.title || result.text || result.url) {
      const sharedContent = result.title || result.text || result.url;
      if (sharedContent) {
        komorebi.library.setSearchQuery(sharedContent);
        setTimeout(() => {
          const searchInput = document.querySelector(
            'input[type="search"], input[placeholder*="search" i]',
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 500);
      }
    }
  });

  const { handleDragOperation } = useDragHandler(komorebi);

  useKeyboardShortcuts({
    komorebi,
    onOpenSettings: () => setSettingsOpen(!settingsOpen),
    onToggleLyrics: () => playerRef.current?.toggleLyrics(),
    onToggleVisualizer: () => playerRef.current?.toggleVisualizer(),
    onSearch: () => {
      const searchInput = document.querySelector(
        'input[type="search"], input[placeholder*="search" i]',
      ) as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    },
  });

  useEffect(() => {
    document.title = t("title");
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", t("about.description"));
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = t("about.description");
      document.head.appendChild(meta);
    }

    const loadThemeMode = () => {
      const mode = komorebi.settings.getSettings().themeMode;
      setThemeMode(mode);
      switch (mode) {
        case "light":
          switchToLightMode();
          break;
        case "dark":
          switchToDarkMode();
          break;
        case "auto":
          switchToAutoMode();
          break;
      }
    };
    loadThemeMode();

    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      setTimeout(() => loadingScreen.remove(), 1100);
    }
  }, [t]);

  return (
    <HelpGuideProvider>
      <DraggableProvider onDragOperation={handleDragOperation}>
        <WallpaperRenderer
          currentSong={komorebi.currentTrack}
          playbackState={{ isPlaying: komorebi.isPlaying }}
        />
        <div className={styles.container}>
          <Sidebar
            komorebi={komorebi}
            onShortcutsChanged={() => {}}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={setSettingsOpen}
            isMobileOpen={isMobileSidebarOpen}
            onMobileOpenChange={setIsMobileSidebarOpen}
          />
          <div className={styles.mainSection}>
            <MainContent
              komorebi={komorebi}
              onMobileMenuClick={() => setIsMobileSidebarOpen(true)}
            />
            <Player ref={playerRef} komorebi={komorebi} />
          </div>
        </div>
        <Suspense fallback={null}>
          <UpdatePromptComponent />
        </Suspense>
      </DraggableProvider>
    </HelpGuideProvider>
  );
}

export function AppShell({ komorebi }: AppShellProps) {
  return (
    <NavigationProvider>
      <AppShellContent komorebi={komorebi} />
    </NavigationProvider>
  );
}
