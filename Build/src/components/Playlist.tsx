import { useState, useEffect, JSX } from "react";
import { useTranslation } from "react-i18next"; "react-i18next";
import {
  Heart,
  List,
  Music,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Share,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import styles from "./Playlist.module.css";
import { generatePlaylistImage } from "../helpers/playlistImageHelper";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./Collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";

type PlaylistProps = {
  musicPlayerHook: ReturnType<
    typeof import("../hooks/musicPlayerHook").useMusicPlayer
  >;
};

export const PlaylistComponent = ({ musicPlayerHook }: PlaylistProps) => {
  const { t } = useTranslation();
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(
    null
  );
  const [playlistImages, setPlaylistImages] = useState<Record<string, string>>(
    {}
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(
    null
  );
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const { library, playSong, createPlaylist, createFolder, removePlaylist, moveToFolder, exportPlaylist, importPlaylist } = musicPlayerHook;

  useEffect(() => {
    const updatePlaylistImages = async () => {
      const newImages: Record<string, string> = {};
      for (const item of library.playlists) {
        if ('songs' in item && item.id !== "all-songs") {
          const image = await generatePlaylistImage(item.songs);
          if (image) newImages[item.id] = image;
        }
      }
      setPlaylistImages(newImages);
    };
    updatePlaylistImages();
  }, [library.playlists, library.songs]);

  const getAllPlaylists = (items: (Playlist | PlaylistFolder)[]): (Playlist | PlaylistFolder)[] => {
    const result: (Playlist | PlaylistFolder)[] = [];
    for (const item of items) {
      result.push(item);
      if ('children' in item) {
        result.push(...getAllPlaylists(item.children));
      }
    }
    return result;
  };

  const allPlaylists = getAllPlaylists(library.playlists);

  const filteredPlaylists = allPlaylists.filter(
    (item) =>
      item.id !== "all-songs" &&
      item.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
  );

  const handlePlaylistSearch = (query: string) => setPlaylistSearchQuery(query);

  const handlePlaylistSelect = (playlist: Playlist) => {
    if (playlist.songs.length > 0) playSong(playlist.songs[0], playlist);
  };

  const handleAllSongsClick = () => {
    const existingAllSongs = library.playlists.find((p) => p.id === "all-songs");
    if (existingAllSongs && 'songs' in existingAllSongs && existingAllSongs.songs.length > 0) {
      playSong(existingAllSongs.songs[0], existingAllSongs);
    } else if (library.songs.length > 0) {
      const allSongsPlaylist: Playlist = {
        id: "all-songs",
        name: t("allSongs"),
        songs: library.songs,
      };
      playSong(allSongsPlaylist.songs[0], allSongsPlaylist);
    }
  };

  const handleAddPlaylist = () => {
    setShowCreatePlaylist(true);
    setNewPlaylistName("");
  };

  const handleCreatePlaylistConfirm = () => {
    if (!newPlaylistName.trim()) return;

    if (editingPlaylistId) {
      const playlist = library.playlists.find((p) => p.id === editingPlaylistId);
      if (playlist) {
        playlist.name = newPlaylistName.trim();
        toast.success(
          t("playlist.playlistRenamed", { name: newPlaylistName.trim() })
        );
      }
    } else {
      createPlaylist(newPlaylistName.trim());
      toast.success(
        t("playlist.playlistCreated", { name: newPlaylistName.trim() })
      );
    }

    setShowCreatePlaylist(false);
    setNewPlaylistName("");
    setEditingPlaylistId(null);
  };

  const handleCreatePlaylistCancel = () => {
    setShowCreatePlaylist(false);
    setNewPlaylistName("");
  };

  const handleEditPlaylist = (playlist: Playlist) => {
    setNewPlaylistName(playlist.name);
    setShowCreatePlaylist(true);
    setEditingPlaylistId(playlist.id);
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    setPlaylistToDelete(playlist);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!playlistToDelete) return;
    removePlaylist(playlistToDelete.id);
    toast.success(t("playlist.playlistDeleted", { name: playlistToDelete.name }));
    setIsDeleteDialogOpen(false);
    setPlaylistToDelete(null);
  };

  const handleSharePlaylist = (playlist: Playlist) => {
    const shareData = {
      title: t("playlist.playlistShareTitle", { name: playlist.name }),
      text: t("playlist.playlistShareText", {
        name: playlist.name,
        count: playlist.songs.length,
      }),
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        navigator.share(shareData);
        toast.success(t("playlist.playlistShared"));
      } else {
        navigator.clipboard.writeText(
          `${shareData.title}\n${shareData.text}\n${shareData.url}`
        );
        toast.success(t("playlist.playlistCopied"));
      }
    } catch {
      toast.error(t("playlist.playlistShareFailed"));
    }
  };

  const handleExportPlaylist = (playlist: Playlist, format: 'json' | 'm3u' = 'json') => {
    exportPlaylist(playlist, format);
  };

  const getPlaylistIcon = (playlistName: string) => {
    if (playlistName.toLowerCase().includes("favorite")) return <Heart size={16} />;
    if (playlistName.toLowerCase().includes("made")) return <List size={16} />;
    return <Music size={16} />;
  };

  const handleImportPlaylist = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.m3u,.m3u8';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await importPlaylist(file);
        } catch (error) {
          // Error handling is done in the importPlaylist function
        }
      }
    };
    input.click();
  };

  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id as string;
    const targetId = over.id as string;

    if (draggedId === targetId) return;

    // Find the dragged item
    const findItem = (items: (Playlist | PlaylistFolder)[], id: string): Playlist | PlaylistFolder | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if ('children' in item) {
          const found = findItem(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const draggedItem = findItem(library.playlists, draggedId);
    if (!draggedItem) return;

    // If dropping on a folder, move into it
    const targetItem = findItem(library.playlists, targetId);
    if (targetItem && 'children' in targetItem) {
      moveToFolder(draggedId, targetId);
      toast.success(t("playlist.movedToFolder", { item: draggedItem.name, folder: targetItem.name }));
    }
  };

  const renderPlaylistItem = (item: Playlist | PlaylistFolder, depth = 0) => {
    if ('songs' in item) {
      return <PlaylistItem key={item.id} item={item} depth={depth} />;
    } else {
      return <FolderItem key={item.id} item={item} depth={depth} renderPlaylistItem={renderPlaylistItem} />;
    }
  };

  const PlaylistItem = ({ item, depth }: { item: Playlist; depth: number }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: item.id,
    });

    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      opacity: isDragging ? 0.5 : 1,
    } : undefined;

    return (
      <div className={styles.playlistItemContainer} style={{ marginLeft: `${depth * 20}px`, ...style }} ref={setNodeRef} {...listeners} {...attributes}>
        <button
          className={styles.playlistItem}
          onClick={() => handlePlaylistSelect(item)}
        >
          {playlistImages[item.id] ? (
            <div className={styles.playlistImage}>
              <img src={playlistImages[item.id]} alt="" loading="lazy" />
            </div>
          ) : (
            getPlaylistIcon(item.name)
          )}
          {item.name}
          <span className={styles.songCount}>{item.songs.length}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={styles.moreButton}
              title={t("moreOptions")}
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuItem onClick={() => handleEditPlaylist(item)}>
              <Edit size={16} style={{ marginRight: 8 }} />
              {t("playlist.editPlaylist")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const folders = library.playlists.filter(p => 'children' in p);
              if (folders.length === 0) {
                alert("No folders available");
                return;
              }
              const folderNames = folders.map(f => f.name);
              const selected = prompt(`Move to folder:\n${folderNames.join('\n')}`, folderNames[0]);
              if (selected) {
                const folder = folders.find(f => f.name === selected);
                if (folder) moveToFolder(item.id, folder.id);
              }
            }}>
              <List size={16} style={{ marginRight: 8 }} />
              {t("playlist.moveToFolder")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              moveToFolder(item.id, null); // Move to root
              toast.success(t("playlist.movedToRoot", { item: item.name }));
            }}>
              <List size={16} style={{ marginRight: 8 }} />
              {t("playlist.moveToRoot")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSharePlaylist(item)}>
              <Share size={16} style={{ marginRight: 8 }} />
              {t("playlist.sharePlaylist")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExportPlaylist(item, 'json')}>
              <Download size={16} style={{ marginRight: 8}} />
              {t("playlist.exportJSON")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportPlaylist(item, 'm3u')}>
              <Download size={16} style={{ marginRight: 8 }} />
              {t("playlist.exportM3U")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDeletePlaylist(item)}
              className={styles.deleteMenuItem}
            >
              <Trash2 size={16} style={{ marginRight: 8 }} />
              {t("playlist.deletePlaylist")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const FolderItem = ({ item, depth, renderPlaylistItem }: { item: PlaylistFolder; depth: number; renderPlaylistItem: (item: Playlist | PlaylistFolder, depth: number) => JSX.Element }) => {
    const { attributes: dragAttributes, listeners: dragListeners, setNodeRef: setDragRef, transform: dragTransform, isDragging: isDragDragging } = useDraggable({
      id: item.id,
    });

    const { setNodeRef: setDropRef, isOver } = useDroppable({
      id: item.id,
    });

    const dragStyle = dragTransform ? {
      transform: `translate3d(${dragTransform.x}px, ${dragTransform.y}px, 0)`,
      opacity: isDragDragging ? 0.5 : 1,
    } : undefined;

    const isOpen = openFolders.has(item.id);
    return (
      <Collapsible key={item.id} open={isOpen} onOpenChange={() => toggleFolder(item.id)}>
        <div className={styles.playlistItemContainer} style={{ marginLeft: `${depth * 20}px`, ...dragStyle, backgroundColor: isOver ? 'rgba(0,0,0,0.1)' : undefined }} ref={(node) => {
          setDragRef(node);
          setDropRef(node);
        }} {...dragAttributes} {...dragListeners}>
          <CollapsibleTrigger asChild>
            <button className={styles.playlistItem}>
              <List size={16} />
              {item.name}
              <span className={styles.songCount}>{item.children.length}</span>
            </button>
          </CollapsibleTrigger>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={styles.moreButton}
                title={t("moreOptions")}
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuItem onClick={() => {
                const newName = prompt(t("playlist.enterFolderName"), item.name);
                if (newName && newName.trim()) {
                  item.name = newName.trim();
                  toast.success(t("playlist.folderRenamed", { name: newName.trim() }));
                }
              }}>
                <Edit size={16} style={{ marginRight: 8 }} />
                {t("playlist.renameFolder")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (confirm(t("playlist.deleteFolderConfirmation", { name: item.name }))) {
                    removePlaylist(item.id);
                    toast.success(t("playlist.folderDeleted", { name: item.name }));
                  }
                }}
                className={styles.deleteMenuItem}
              >
                <Trash2 size={16} style={{ marginRight: 8 }} />
                {t("playlist.deleteFolder")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent>
          {item.children.map((child) => renderPlaylistItem(child, depth + 1))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className={styles.playlistContainer}>
      <div className={styles.searchContainer}>
        <div className={styles.searchWrapper}>
          <div className={styles.searchIcon}>
            <Music size={16} />
          </div>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t("playlist.searchPlaylists")}
            value={playlistSearchQuery}
            onChange={(e: any) => handlePlaylistSearch(e.target.value)}
          />
        </div>
      </div>
      <div>
        <button
          className={`${styles.playlistItem} ${styles.addPlaylistButton}`}
          onClick={handleAddPlaylist}
        >
          <Plus size={16} />
          {t("playlist.addPlaylist")}
        </button>
        <button
          className={`${styles.playlistItem} ${styles.addPlaylistButton}`}
          onClick={() => {
            const name = prompt(t("playlist.enterFolderName"));
            if (name && name.trim()) {
              createFolder(name.trim());
              toast.success(t("playlist.folderCreated", { name: name.trim() }));
            }
          }}
        >
          <List size={16} />
          {t("playlist.addFolder")}
        </button>
        <button
          className={`${styles.playlistItem} ${styles.addPlaylistButton}`}
          onClick={handleImportPlaylist}
        >
          <Upload size={16} />
          {t("playlist.importPlaylist")}
        </button>
      </div>

            <div className={styles.playlistList}>
        <DndContext onDragEnd={handleDragEnd}>
          {/* All Songs */}
          <button
            className={`${styles.playlistItem} ${styles.allSongsItem}`}
            onClick={handleAllSongsClick}
          >
            <Music size={16} />
            {t("allSongs")}
            <span className={styles.songCount}>{library.songs.length}</span>
          </button>

          {/* Favorites */}
          <button
            className={`${styles.playlistItem} ${styles.favoritesItem}`}
            onClick={() =>
              handlePlaylistSelect({
                id: "favorites",
                name: t("favorites.favorites"),
                songs: library.songs.filter((s) => library.favorites.includes(s.id)),
              })
            }
          >
            <Heart size={16} />
            {t("favorites.favorites")}
            <span className={styles.songCount}>{library.favorites.length}</span>
          </button>

          {filteredPlaylists.map((item) => renderPlaylistItem(item))}

          {filteredPlaylists.length === 0 && playlistSearchQuery && (
            <div className={styles.noResults}>{t("noPlaylistsFound")}</div>
          )}
        </DndContext>
      </div>

      {/* Create Playlist Modal */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlaylistId ? t("playlist.editPlaylist") : t("playlist.createPlaylist")}</DialogTitle>
            <DialogDescription>
              {t("playlist.enterPlaylistName")}
            </DialogDescription>
          </DialogHeader>
          <div style={{ margin: "var(--spacing-4) 0" }}>
            <Input
              placeholder={t("playlist.enterPlaylistName")}
              value={newPlaylistName}
              onChange={(e: any) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === "Enter") handleCreatePlaylistConfirm();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCreatePlaylistCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreatePlaylistConfirm}
              disabled={!newPlaylistName.trim()}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Playlist Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("playlist.deletePlaylist")}</DialogTitle>
            <DialogDescription>
              {t("playlist.deletePlaylistConfirmation", { name: playlistToDelete?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
