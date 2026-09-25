import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "../shared/Icon";
import { Button } from "../primitives/Button";
import { generatePlaylistImage } from "../../../platform/utils/playlistImage";
import { flattenPlaylists } from "../../../platform/library";
import { PlaylistItem } from "../primitives/PlaylistItem";
import { FolderItem } from "../primitives/FolderItem";
import { ConfirmDialog, type DialogType } from "../primitives/ConfirmDialog";
import { PlaylistToolbar } from "./PlaylistToolbar";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";
import type { Playlist, PlaylistFolder } from "../../../core/engine/types";
import styles from "./Playlist.module.css";

interface PlaylistViewProps {
  library: UseKomorebiReturn["library"];
  playSong: UseKomorebiReturn["playSong"];
  version: number;
}

export const PlaylistView = memo(function PlaylistView({
  library,
  playSong,
}: PlaylistViewProps) {
  const { t } = useTranslation();
  const libraryState = library.getState();
  const songs = libraryState.songs;
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  const [playlistImages, setPlaylistImages] = useState<Record<string, string>>(
    {},
  );
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const [dialogType, setDialogType] = useState<DialogType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<
    Playlist | PlaylistFolder | null
  >(null);
  const [, setDialogValue] = useState("");
  const [availableFolders, setAvailableFolders] = useState<
    { folder: PlaylistFolder; path: string[] }[]
  >([]);

  const playlistListRef = useRef<HTMLDivElement | null>(null);

  const toggleFolder = useCallback((folderId: string) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) newSet.delete(folderId);
      else newSet.add(folderId);
      return newSet;
    });
  }, []);

  const createPlaylist = useCallback(
    (name: string) => {
      const playlist: Playlist = {
        id: `playlist-${Date.now()}`,
        name,
        songs: [],
      };
      library.addPlaylist(playlist);
      toast.success(t("playlist.playlistCreated", { name }));
    },
    [library, t],
  );

  const createFolder = useCallback(
    (name: string) => {
      library.createFolder(name);
      toast.success(t("playlist.folderCreated", { name }));
    },
    [library, t],
  );

  const removePlaylist = useCallback(
    (id: string) => {
      library.removePlaylist(id);
      toast.success(
        t("playlist.playlistDeleted", { name: dialogItem?.name || "" }),
      );
    },
    [library, dialogItem],
  );

  useEffect(() => {
    let isCancelled = false;
    const allPlaylists = flattenPlaylists(libraryState.playlists).filter(
      (p) => p.id !== "all-songs",
    );
    const BATCH_SIZE = 5;

    const updateImages = async () => {
      const newImages: Record<string, string> = {};
      for (let i = 0; i < allPlaylists.length; i += BATCH_SIZE) {
        if (isCancelled) return;
        const batch = allPlaylists.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (playlist) => {
            try {
              const image = await generatePlaylistImage(playlist.songs);
              if (image && !isCancelled) newImages[playlist.id] = image;
            } catch {}
          }),
        );
        if (!isCancelled)
          setPlaylistImages((prev) => ({ ...prev, ...newImages }));
        if (i + BATCH_SIZE < allPlaylists.length)
          await new Promise((r) => setTimeout(r, 50));
      }
    };

    const timeoutId = setTimeout(updateImages, 100);
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [libraryState.playlists, songs]);

  const filteredPlaylists = useMemo(
    () =>
      libraryState.playlists.filter(
        (item) =>
          item.id !== "all-songs" &&
          item.name.toLowerCase().includes(playlistSearchQuery.toLowerCase()),
      ),
    [libraryState.playlists, playlistSearchQuery],
  );

  const getPlaylistIcon = useCallback((name: string) => {
    if (name.toLowerCase().includes("favorite"))
      return <Icon name="heart" size={16} decorative />;
    if (name.toLowerCase().includes("made"))
      return <Icon name="list" size={16} decorative />;
    return <Icon name="music" size={16} decorative />;
  }, []);

  const openDialog = useCallback(
    (type: DialogType, item?: Playlist | PlaylistFolder) => {
      setDialogType(type);
      setDialogItem(item || null);
      setDialogValue(item?.name || "");
      if (type === "move" && item) {
        const getAllFolders = (
          items: (Playlist | PlaylistFolder)[],
          path: string[] = [],
        ): { folder: PlaylistFolder; path: string[] }[] => {
          const folders: { folder: PlaylistFolder; path: string[] }[] = [];
          for (const item of items) {
            if ("children" in item) {
              folders.push({ folder: item, path: [...path] });
              folders.push(
                ...getAllFolders(item.children, [...path, item.name]),
              );
            }
          }
          return folders;
        };
        setAvailableFolders(getAllFolders(libraryState.playlists));
      }
      setDialogOpen(true);
    },
    [libraryState.playlists],
  );

  const handleDialogConfirm = useCallback(
    (value?: string | null) => {
      if (!dialogType) return;
      switch (dialogType) {
        case "createPlaylist":
          createPlaylist(value || "");
          break;
        case "createFolder":
          createFolder(value || "");
          break;
        case "delete":
          if (dialogItem && "children" in dialogItem) {
            library.removeFolder(dialogItem.id);
            toast.success(
              t("playlist.playlistDeleted", { name: dialogItem.name }),
            );
          } else {
            dialogItem && removePlaylist(dialogItem.id);
          }
          break;
        case "rename":
          if (dialogItem && value?.trim()) {
            if ("children" in dialogItem) {
              library.renameFolder(dialogItem.id, value.trim());
            } else {
              library.updatePlaylist(dialogItem.id, { name: value.trim() });
            }
            toast.success(t("playlist.renamed", { name: value.trim() }));
          }
          break;
        case "move":
          if (dialogItem && "children" in dialogItem) {
            library.moveFolder(dialogItem.id, value || "root");
          } else if (dialogItem) {
            library.moveToFolder(dialogItem.id, value || "root");
          }
          toast.success(
            t("playlist.movedToRoot", { item: dialogItem?.name || "" }),
          );
          break;
      }
      setDialogOpen(false);
    },
    [dialogType, dialogItem, createPlaylist, createFolder, removePlaylist, t],
  );

  const handlePlaylistSelect = useCallback(
    (playlist: Playlist) => {
      const song = playlist.songs[0];
      if (song) playSong(song, playlist);
    },
    [playSong],
  );

  const handleAllSongsClick = useCallback(() => {
    const allSongs: Playlist = {
      id: "all-songs",
      name: t("allSongs"),
      songs: songs,
    };
    const song = allSongs.songs[0];
    if (song) playSong(song, allSongs);
  }, [songs, playSong, t]);

  const handleShare = useCallback(
    (playlist: Playlist) => {
      const shareData = {
        title: t("playlist.shareTitle", { name: playlist.name }),
        text: t("playlist.shareText", {
          name: playlist.name,
          count: playlist.songs.length,
        }),
      };
      try {
        if (navigator.share && navigator.canShare(shareData))
          navigator.share(shareData);
        else {
          navigator.clipboard.writeText(
            `${shareData.title}\n${shareData.text}`,
          );
          toast.success(t("playlist.copied"));
        }
      } catch {
        toast.error(t("playlist.shareFailed"));
      }
    },
    [t],
  );

  const handleExport = useCallback(
    (playlist: Playlist, format: "json" | "m3u") => {
      if (format === "json") {
        const blob = new Blob([JSON.stringify(playlist, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${playlist.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const content = [
          "#EXTM3U",
          ...playlist.songs.map(
            (s) =>
              `#EXTINF:${Math.round(s.duration || 0)},${s.artist} - ${s.title}\n${s.url || ""}`,
          ),
        ].join("\n");
        const blob = new Blob([content], { type: "audio/x-mpegurl" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${playlist.name}.m3u`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(t("playlist.exported"));
    },
    [t],
  );

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.m3u,.m3u8";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          if (file.name.endsWith(".json")) {
            const playlist: Playlist = JSON.parse(text);
            if (playlist.name) {
              playlist.id = `playlist-${Date.now()}`;
              library.addPlaylist(playlist);
              toast.success(t("playlist.imported", { name: playlist.name }));
            }
          } else toast.info("M3U import not yet supported");
        } catch {
          toast.error(t("playlist.importFailed"));
        }
      }
    };
    input.click();
  }, [library, t]);

  const renderPlaylistItem = useCallback(
    (item: Playlist | PlaylistFolder, depth = 0): React.ReactElement | null => {
      if ("songs" in item) {
        return (
          <PlaylistItem
            key={item.id}
            item={item}
            playlistImages={playlistImages}
            depth={depth}
            getPlaylistIcon={getPlaylistIcon}
            onSelect={() => handlePlaylistSelect(item)}
            onRename={() => openDialog("rename", item)}
            onShare={() => handleShare(item)}
            onMoveToFolder={() => openDialog("move", item)}
            onMoveToRoot={() => library.moveToFolder(item.id, "root")}
            onExportJson={() => handleExport(item, "json")}
            onExportM3u={() => handleExport(item, "m3u")}
            onDelete={() => openDialog("delete", item)}
          />
        );
      }
      return (
        <FolderItem
          key={item.id}
          item={item}
          depth={depth}
          isOpen={openFolders.has(item.id)}
          onToggle={() => toggleFolder(item.id)}
          onRename={() => openDialog("rename", item)}
          onMoveToFolder={() => openDialog("move", item)}
          onMoveToRoot={() => library.moveFolder(item.id, "root")}
          onDelete={() => openDialog("delete", item)}
          renderPlaylistItem={renderPlaylistItem}
        />
      );
    },
    [
      playlistImages,
      getPlaylistIcon,
      handlePlaylistSelect,
      openDialog,
      handleShare,
      handleExport,
      openFolders,
      toggleFolder,
    ],
  );

  return (
    <div className={styles.playlistContainer}>
      <PlaylistToolbar
        searchQuery={playlistSearchQuery}
        onSearchChange={setPlaylistSearchQuery}
        onCreatePlaylist={() => openDialog("createPlaylist")}
        onCreateFolder={() => openDialog("createFolder")}
        onImport={handleImport}
      />

      <div
        ref={playlistListRef}
        className={styles.playlistList}
        style={{ position: "relative" }}
        data-tour="playlists"
      >
        <Button
          variant="ghost"
          className={`${styles.playlistItem} ${styles.allSongsItem}`}
          onClick={handleAllSongsClick}
        >
          <Icon name="music" size={16} decorative />
          {t("allSongs")}
          <span className={styles.songCount}>{songs.length}</span>
        </Button>

        <Button
          variant="ghost"
          className={`${styles.playlistItem} ${styles.favoritesItem}`}
          onClick={() =>
            handlePlaylistSelect({
              id: "favorites",
              name: t("favorites.favorites"),
              songs: songs.filter((s) => libraryState.favorites.includes(s.id)),
            })
          }
        >
          <Icon name="heart" size={16} decorative />
          {t("favorites.favorites")}
          <span className={styles.songCount}>
            {libraryState.favorites.length}
          </span>
        </Button>

        {filteredPlaylists.map((item) => renderPlaylistItem(item))}

        {filteredPlaylists.length === 0 && playlistSearchQuery && (
          <div className={styles.noResults}>{t("noPlaylistsFound")}</div>
        )}
      </div>

      <ConfirmDialog
        type={dialogType || "confirm"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={dialogItem}
        folders={availableFolders}
        onConfirm={handleDialogConfirm}
      />
    </div>
  );
});

export { PlaylistView as PlaylistComponent };
export default PlaylistView;
