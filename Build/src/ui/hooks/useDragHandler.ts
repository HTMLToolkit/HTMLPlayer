import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { DragItem, DropZone } from "../components/primitives/Draggable";
import type { UseKomorebiReturn } from "../../hooks/useKomorebi";
import { findPlaylistById } from "../../platform/library";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("dragHandler");

export function useDragHandler(komorebi: UseKomorebiReturn) {
  const { t } = useTranslation();
  const library = komorebi.library;
  const libraryState = library.getState();

  const handleDragOperation = useCallback(
    (dragItem: DragItem, dropZone: DropZone) => {
      logger.debug("Drag operation:", { dragItem, dropZone });

      if (dragItem.type === "song" && dropZone.type === "playlist") {
        const songId = dragItem.id;
        const targetPlaylistId = dropZone.id;
        const song = libraryState.songs.find((s) => s.id === songId);
        const targetPlaylist = findPlaylistById(
          libraryState.playlists,
          targetPlaylistId,
        );

        if (
          targetPlaylist &&
          targetPlaylist.songs.some((s) => s.id === songId)
        ) {
          toast.info(
            t("songAlreadyInPlaylist", {
              song: song?.title,
              playlist: targetPlaylist.name,
            }),
          );
          return;
        }

        if (song && targetPlaylist) {
          library.addToPlaylist(targetPlaylistId, song);
          toast.success(
            t("songMovedToPlaylist", {
              song: song.title,
              playlist: targetPlaylist.name,
            }),
          );
        }
        return;
      }

      if (dragItem.type === "song" && dropZone.type === "song") {
        const enginePlaylist = komorebi.state.currentPlaylist;
        const currentPlaylist = enginePlaylist
          ? library.getPlaylist(enginePlaylist.id) ?? enginePlaylist
          : null;
        if (currentPlaylist) {
          const songs = [...currentPlaylist.songs];
          const oldIndex = songs.findIndex((s) => s.id === dragItem.id);
          const newIndex = songs.findIndex((s) => s.id === dropZone.id);
          if (oldIndex !== -1 && newIndex !== -1) {
            const [removed] = songs.splice(oldIndex, 1);
            songs.splice(newIndex, 0, removed);
            library.reorderPlaylistSongs(currentPlaylist.id, songs);
          }
        }
        return;
      }

      if (
        (dragItem.type === "playlist" || dragItem.type === "folder") &&
        dropZone.type === "folder"
      ) {
        const targetFolderId = dropZone.id;
        if (dragItem.type === "playlist") {
          library.moveToFolder(dragItem.id, targetFolderId);
        } else {
          library.moveFolder(dragItem.id, targetFolderId);
        }
        toast.success(
          t("playlist.reordered", { item: dragItem.id }) || `Moved item`,
        );
        return;
      }

      logger.debug("Unhandled drag operation:", { dragItem, dropZone });
    },
    [komorebi.state.currentPlaylist, libraryState, library, t],
  );

  return { handleDragOperation };
}
