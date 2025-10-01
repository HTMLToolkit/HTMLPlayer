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
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";

export default function IndexPage() {
  const { t } = useTranslation();
  const musicPlayerHook = useMusicPlayer();
  const [, setThemeMode] = useState<ThemeMode>("auto");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Unified drag and drop handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Only handle song-related drags, let playlist component handle playlist drags
    if (!activeId.startsWith('song-')) {
      return; // Let the playlist DndContext handle this
    }

    // Check if we're dropping a song onto a playlist
    if (activeId.startsWith('song-') && overId.startsWith('playlist-')) {
      const songId = activeId.replace('song-', '');
      const targetPlaylistId = overId.replace('playlist-', '');
      
      // Get the current playlist from playerState
      const sourcePlaylistId = musicPlayerHook.playerState.currentPlaylist?.id || null;
      
      // Move the song to the target playlist
      musicPlayerHook.moveSongToPlaylist(songId, sourcePlaylistId, targetPlaylistId);
      
      // Find the song and target playlist for toast message
      const song = musicPlayerHook.library.songs.find(s => s.id === songId);
      const targetPlaylist = findPlaylistById(musicPlayerHook.library.playlists, targetPlaylistId);
      
      if (song && targetPlaylist) {
        toast.success(t("songMovedToPlaylist", { song: song.title, playlist: targetPlaylist.name }));
      }
      return;
    }

    // Handle song reordering within a playlist (existing logic)
    if (activeId.startsWith('song-') && overId.startsWith('song-')) {
      const currentPlaylist = musicPlayerHook.playerState.currentPlaylist;
      if (currentPlaylist) {
        const songs = currentPlaylist.songs;
        const oldIndex = songs.findIndex(song => `song-${song.id}` === activeId);
        const newIndex = songs.findIndex(song => `song-${song.id}` === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newSongs = arrayMove(songs, oldIndex, newIndex);
          musicPlayerHook.reorderPlaylistSongs(currentPlaylist.id, newSongs);
        }
      }
      return;
    }
  };

  // Helper function to find playlist by ID in the nested structure
  const findPlaylistById = (items: (Playlist | PlaylistFolder)[], id: string): Playlist | null => {
    for (const item of items) {
      if (item.id === id && 'songs' in item) {
        return item as Playlist;
      }
      if ('children' in item) {
        const found = findPlaylistById(item.children, id);
        if (found) return found;
      }
    }
    return null;
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
    document.title = t("title");

    // Set the meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        t("description")
      );
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = t("description");
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
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
    </DndContext>
  );
}
