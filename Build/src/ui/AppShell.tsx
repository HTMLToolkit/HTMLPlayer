import {
  useRef,
  useEffect,
  useState,
  lazy,
  Suspense,
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";
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
import { prepareAndStoreSong } from "../helpers/addSong";
import {
  switchToAutoMode,
  switchToDarkMode,
  switchToLightMode,
  ThemeMode,
} from "./theming";
import styles from "../pages/_index.module.css";
import type { UseKomorebiReturn } from "../hooks/useKomorebi";
import type { Track } from "../core/engine/types";
import {
  selectCurrentTrack,
  selectIsPlaying,
  useKomorebiStore,
  EMPTY_ENGINE_STATE,
} from "../store";
import { createLogger } from "../helpers/logger";

const logger = createLogger("appErrorBoundary");

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Last line of defense. Catches render-time failures anywhere under the root,
 * resets the store to a safe empty snapshot so stale UI state cannot pin the
 * app in a broken subtree, and offers a reload instead of a blank screen.
 */
class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error("Unhandled render error", {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
    try {
      useKomorebiStore.setState({
        snapshot: EMPTY_ENGINE_STATE,
        loading: false,
        error: `Unhandled error: ${error.message}`,
      });
    } catch (storeError) {
      logger.error("Failed to reset store after error", {
        error: String(storeError),
      });
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#111",
          color: "#eee",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: "36rem", margin: 0, opacity: 0.8 }}>
          {this.state.message}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: "0.6rem 1.4rem",
            borderRadius: "8px",
            border: "none",
            background: "#4c9aff",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

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
  const currentSong = useKomorebiStore(selectCurrentTrack);
  const isPlaying = useKomorebiStore(selectIsPlaying);

  const handleAddSong = async (song: Track, file?: File) => {
    if (!file) return;
    const stored = await prepareAndStoreSong(song, file);
    komorebi.addSong(stored);
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
          currentSong={currentSong}
          playbackState={{ isPlaying }}
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
    <AppErrorBoundary>
      <NavigationProvider>
        <AppShellContent komorebi={komorebi} />
      </NavigationProvider>
    </AppErrorBoundary>
  );
}
