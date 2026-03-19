import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { DragItem, DropZone } from "../components/primitives/Draggable";
import type { UseKomorebiReturn } from "../../hooks/useKomorebi";
import type { Playlist, PlaylistFolder } from "../../core/engine/types";

export function useDragHandler(komorebi: UseKomorebiReturn) {
  const { t } = useTranslation();
  const library = komorebi.library;
  const libraryState = library.getState();

  const findPlaylistById = useCallback((
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
  }, []);

  const handleDragOperation = useCallback((dragItem: DragItem, dropZone: DropZone) => {
    console.log("Drag operation:", { dragItem, dropZone });

    if (dragItem.type === "song" && dropZone.type === "playlist") {
      const songId = dragItem.id;
      const targetPlaylistId = dropZone.id;
      const song = libraryState.songs.find((s) => s.id === songId);
      const targetPlaylist = findPlaylistById(libraryState.playlists, targetPlaylistId);

      if (targetPlaylist && targetPlaylist.songs.some((s) => s.id === songId)) {
        toast.info(t("songAlreadyInPlaylist", { song: song?.title, playlist: targetPlaylist.name }));
        return;
      }

      if (song && targetPlaylist) {
        const playlist = library.getPlaylist(targetPlaylistId);
        if (playlist) {
          playlist.songs.push(song);
          library.updatePlaylist(targetPlaylistId, { songs: playlist.songs });
        }
        toast.success(t("songMovedToPlaylist", { song: song.title, playlist: targetPlaylist.name }));
      }
      return;
    }

    if (dragItem.type === "song" && dropZone.type === "song") {
      const currentPlaylist = komorebi.state.currentPlaylist;
      if (currentPlaylist) {
        const songs = [...currentPlaylist.songs];
        const oldIndex = songs.findIndex((s) => s.id === dragItem.id);
        const newIndex = songs.findIndex((s) => s.id === dropZone.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const [removed] = songs.splice(oldIndex, 1);
          songs.splice(newIndex, 0, removed);
          library.updatePlaylist(currentPlaylist.id, { songs });
        }
      }
      return;
    }

    if (dragItem.type === "playlist" && dropZone.type === "folder") {
      const targetFolderId = dropZone.id;
      const folderId = dragItem.id;

      const findParentFolder = (
        items: (Playlist | PlaylistFolder)[],
        id: string,
      ): string | null => {
        for (const item of items) {
          if (item.id === id) return null;
          if ("children" in item) {
            for (const child of item.children) {
              if (child.id === id) return item.id;
              const found = findParentFolder(item.children, id);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const targetParentFolderId = findParentFolder(libraryState.playlists, targetFolderId);
      const folder = libraryState.playlists.find((p) => p.id === folderId);
      library.updatePlaylist(folderId, { parentId: targetParentFolderId ?? undefined } as any);
      toast.success(t("playlist.reordered", { item: folder?.name || "Folder" }) || `Moved folder`);
      return;
    }

    console.log("Unhandled drag operation:", { dragItem, dropZone });
  }, [komorebi.state.currentPlaylist, libraryState, findPlaylistById, library, t]);

  return { handleDragOperation };
}
