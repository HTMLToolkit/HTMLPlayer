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
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DraggableProvider, DragItem, DropZone } from "../components/Draggable";
import {
  useFileHandler,
  useShareTarget,
  importAudioFiles,
} from "../helpers/filePickerHelper";
import { HelpGuideProvider } from "../components/HelpGuide";
import WallpaperRenderer from "../components/Wallpaper";

export default function IndexPage() {
  const { t } = useTranslation();
  const musicPlayerHook = useMusicPlayer();
  const [, setThemeMode] = useState<ThemeMode>("auto");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Initialize file handler for PWA file opening
  // @ts-ignore
  const { isSupported: fileHandlerSupported } = useFileHandler(
    musicPlayerHook.addSong,
    t,
    musicPlayerHook.isInitialized,
  );

  // Initialize share target handler
  useShareTarget((result) => {
    if (result.files.length > 0) {
      toast.success(
        t("shareTarget.filesReceived", { count: result.files.length }),
      );
      importAudioFiles(result.files, musicPlayerHook.addSong, t);
    }
    if (result.title || result.text || result.url) {
      const sharedContent = result.title || result.text || result.url;
      if (sharedContent) {
        // Treat shared text as a search query
        musicPlayerHook.setSearchQuery(sharedContent);
        toast.info(t("shareTarget.searchQuery", { query: sharedContent }));

        // Focus search input after a short delay to ensure UI is ready
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

  // Handle all drag operations with our unified system
  const handleDragOperation = (dragItem: DragItem, dropZone: DropZone) => {
    console.log("Drag operation:", { dragItem, dropZone });

    // Handle song being dropped on a playlist
    if (dragItem.type === "song" && dropZone.type === "playlist") {
      const songId = dragItem.id;
      const targetPlaylistId = dropZone.id;

      console.log("Adding song to playlist:", { songId, targetPlaylistId });

      // Find the song and target playlist for toast message
      const song = musicPlayerHook.library.songs.find((s) => s.id === songId);
      const findPlaylistById = (
        items: (Playlist | PlaylistFolder)[],
        id: string,
      ): Playlist | null => {
        for (const item of items) {
          if (item.id === id && "songs" in item) {
            return item as Playlist;
          }
          if ("children" in item) {
            const found = findPlaylistById(item.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const targetPlaylist = findPlaylistById(
        musicPlayerHook.library.playlists,
        targetPlaylistId,
      );

      // Check if song is already in the playlist
      if (targetPlaylist && targetPlaylist.songs.some((s) => s.id === songId)) {
        if (song && targetPlaylist) {
          toast.info(
            t("songAlreadyInPlaylist", {
              song: song.title,
              playlist: targetPlaylist.name,
            }),
          );
        }
        return;
      }

      // Add the song to the target playlist
      musicPlayerHook.addToPlaylist(targetPlaylistId, songId);

      if (song && targetPlaylist) {
        // Show success toast
        toast.success(
          t("songMovedToPlaylist", {
            song: song.title,
            playlist: targetPlaylist.name,
          }),
          {
            duration: 3000,
          },
        );
      }
      return;
    }

    // Handle song reordering within a playlist
    if (dragItem.type === "song" && dropZone.type === "song") {
      const currentPlaylist = musicPlayerHook.playerState.currentPlaylist;
      if (currentPlaylist) {
        const songs = currentPlaylist.songs;
        const oldIndex = songs.findIndex((song) => song.id === dragItem.id);
        const newIndex = songs.findIndex((song) => song.id === dropZone.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          // We need arrayMove, let me import it
          const newSongs = [...songs];
          const [movedSong] = newSongs.splice(oldIndex, 1);
          newSongs.splice(newIndex, 0, movedSong);

          musicPlayerHook.reorderPlaylistSongs(currentPlaylist.id, newSongs);
          console.log("Reordered songs in playlist:", {
            from: oldIndex,
            to: newIndex,
          });
        }
      }
      return;
    }

    // Handle playlist being dropped on another playlist (reordering)
    if (dragItem.type === "playlist" && dropZone.type === "playlist") {
      const playlistId = dragItem.id;
      const targetPlaylistId = dropZone.id;

      // Find the parent folder of the target playlist to maintain folder structure
      const findParentFolder = (
        items: (Playlist | PlaylistFolder)[],
        targetId: string,
        parentId: string | null = null,
      ): string | null | undefined => {
        for (const item of items) {
          if (item.id === targetId) {
            return parentId;
          }
          if ("children" in item) {
            const found = findParentFolder(item.children, targetId, item.id);
            if (found !== undefined) return found;
          }
        }
        return undefined;
      };

      const targetParentFolderId = findParentFolder(
        musicPlayerHook.library.playlists,
        targetPlaylistId,
      );
      const draggedPlaylist = dragItem.data;

      // Move the dragged playlist to be before the target playlist, in the same folder
      musicPlayerHook.moveToFolder(
        playlistId,
        targetParentFolderId ?? null,
        targetPlaylistId,
      );

      toast.success(
        t("playlist.reordered", {
          item: draggedPlaylist?.name || "Playlist",
        }) || `Moved "${draggedPlaylist?.name || "Playlist"}" playlist`,
      );
      return;
    }

    // Handle playlist being dropped on a folder
    if (dragItem.type === "playlist" && dropZone.type === "folder") {
      const playlistId = dragItem.id;
      const targetFolderId = dropZone.id;

      musicPlayerHook.moveToFolder(playlistId, targetFolderId);
      toast.success(
        t("playlist.movedToFolder", {
          item: dragItem.data?.name || "Playlist",
          folder: dropZone.data?.name || "Folder",
        }),
      );
      return;
    }

    // Handle folder being dropped on another folder (reordering)
    if (dragItem.type === "folder" && dropZone.type === "folder") {
      const folderId = dragItem.id;
      const targetFolderId = dropZone.id;

      // Prevent dropping a folder into itself
      if (folderId === targetFolderId) {
        return;
      }

      // Find the parent folder of the target folder to maintain folder structure
      const findParentFolder = (
        items: (Playlist | PlaylistFolder)[],
        targetId: string,
        parentId: string | null = null,
      ): string | null | undefined => {
        for (const item of items) {
          if (item.id === targetId) {
            return parentId;
          }
          if ("children" in item) {
            const found = findParentFolder(item.children, targetId, item.id);
            if (found !== undefined) return found;
          }
        }
        return undefined;
      };

      const targetParentFolderId = findParentFolder(
        musicPlayerHook.library.playlists,
        targetFolderId,
      );

      // Move the folder to be before the target folder, in the same parent folder
      musicPlayerHook.moveToFolder(
        folderId,
        targetParentFolderId ?? null,
        targetFolderId,
      );

      toast.success(
        t("playlist.reordered", {
          item: dragItem.data?.name || "Folder",
        }) || `Reordered "${dragItem.data?.name || "Folder"}" folder`,
      );
      return;
    }

    // TODO: Handle playlist/folder operations
    console.log("Unhandled drag operation:", { dragItem, dropZone });
  };

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
        showLyrics: !currentSettings.showLyrics,
      });
    },
    onToggleVisualizer: () => {
      // Toggle visualizer (this might need to be implemented differently)
      // For now, just log as the visualizer system might not be fully set up
      console.log("Toggle visualizer shortcut - implementation needed");
    },
    onSearch: () => {
      // Focus search input if it exists
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
    // Set the document title
    document.title = t("title");

    // Set the meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", t("about.description"));
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = t("about.description");
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

    // Hide loading screen once React has fully rendered
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      // Let the CSS animation handle the fade-out
      // Just remove it from DOM after animation completes
      setTimeout(() => {
        loadingScreen.remove();
      }, 1100);
    }
  }, []);

  return (
    <HelpGuideProvider>
      <DraggableProvider onDragOperation={handleDragOperation}>
        <WallpaperRenderer
          currentSong={musicPlayerHook.playerState.currentSong}
          playbackState={musicPlayerHook.playerState}
        />
        <div className={styles.container}>
          <Sidebar
            musicPlayerHook={musicPlayerHook}
            onShortcutsChanged={reloadShortcuts}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={setSettingsOpen}
            isMobileOpen={isMobileSidebarOpen}
            onMobileOpenChange={setIsMobileSidebarOpen}
          />
          <div className={styles.mainSection}>
            <MainContent
              musicPlayerHook={musicPlayerHook}
              onMobileMenuClick={() => setIsMobileSidebarOpen(true)}
            />
            <Player
              musicPlayerHook={musicPlayerHook}
              settings={{
                volume: 0,
                crossfade: 0,
                defaultShuffle: false,
                defaultRepeat: "off",
                themeMode: "light",
                colorTheme: "",
                wallpaper: "None",
                autoPlayNext: false,
                compactMode: false,
                showAlbumArt: false,
                showLyrics: false,
                sessionRestore: true,
                gaplessPlayback: false,
                smartShuffle: true,
                lastPlayedSongId: undefined,
                lastPlayedPlaylistId: undefined,
                language: "English",
                tempo: 1,
                pitch: 0,
                discordEnabled: false,
                erudaEnabled: false,
              }}
            />
          </div>
        </div>
      </DraggableProvider>
    </HelpGuideProvider>
  );
}
