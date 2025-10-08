import { useState, useEffect, JSX, memo, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DropZone, DraggableItem } from "./Draggable";
import styles from "./Playlist.module.css";
import { generatePlaylistImage } from "../helpers/playlistImageHelper";
import modalStyles from "./Dialog.module.css";
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
  useRightClickMenu,
} from "./DropdownMenu";
import { ScrollText } from "./ScrollText";
import { Icon } from "./Icon";

interface PlaylistProps {
  musicPlayerHook: ReturnType<
    typeof import("../hooks/musicPlayerHook").useMusicPlayer
  >;
}

export const PlaylistComponent = ({ musicPlayerHook }: PlaylistProps) => {
  const { t } = useTranslation();
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistImages, setPlaylistImages] = useState<Record<string, string>>(
    {}
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | PlaylistFolder | null>(
    null
  );
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const toggleFolder = useCallback((folderId: string) => {
    setOpenFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [itemToMove, setItemToMove] = useState<Playlist | PlaylistFolder | null>(null);
  const [availableFolders, setAvailableFolders] = useState<{ folder: PlaylistFolder; path: string[] }[]>([]);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [itemToRename, setItemToRename] = useState<Playlist | PlaylistFolder | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");


  const { library, playSong, createPlaylist, createFolder, removePlaylist, moveToFolder, exportPlaylist, importPlaylist } = musicPlayerHook;

  useEffect(() => {
    const updatePlaylistImages = async () => {
      const newImages: Record<string, string> = {};

      // Recursive function to find all playlists in the tree
      const findAllPlaylists = (items: (Playlist | PlaylistFolder)[]): Playlist[] => {
        const result: Playlist[] = [];
        for (const item of items) {
          if ('children' in item) {
            // This is a folder, recurse into children
            result.push(...findAllPlaylists(item.children));
          } else if ('songs' in item) {
            // This is a playlist
            result.push(item);
          }
        }
        return result;
      };

      const allPlaylists = findAllPlaylists(library.playlists);

      for (const playlist of allPlaylists) {
        if (playlist.id !== "all-songs") {
          const image = await generatePlaylistImage(playlist.songs);
          if (image) newImages[playlist.id] = image;
        }
      }
      setPlaylistImages(newImages);
    };
    updatePlaylistImages();
  }, [library.playlists, library.songs]);

  const getAllPlaylists = useCallback((items: (Playlist | PlaylistFolder)[]): (Playlist | PlaylistFolder)[] => {
    const result: (Playlist | PlaylistFolder)[] = [];
    for (const item of items) {
      result.push(item);
      if ('children' in item) {
        result.push(...getAllPlaylists(item.children));
      }
    }
    return result;
  }, []);

  const filteredPlaylists = useMemo(() => library.playlists.filter(
    (item) =>
      item.id !== "all-songs" &&
      item.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
  ), [library.playlists, playlistSearchQuery]);

  const handlePlaylistSearch = (query: string) => setPlaylistSearchQuery(query);

  const handlePlaylistSelect = useCallback((playlist: Playlist) => {
    if (playlist.songs.length > 0) playSong(playlist.songs[0], playlist);
  }, [playSong]);

  const handleAllSongsClick = useCallback(() => {
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
  }, [library.playlists, library.songs, playSong]);

  const handleAddPlaylist = () => {
    setShowCreatePlaylist(true);
    setNewPlaylistName("");
  };

  const handleCreatePlaylistConfirm = useCallback(() => {
    if (!newPlaylistName.trim()) return;

    createPlaylist(newPlaylistName.trim());
    toast.success(
      t("playlist.playlistCreated", { name: newPlaylistName.trim() })
    );

    setShowCreatePlaylist(false);
    setNewPlaylistName("");
  }, [newPlaylistName, createPlaylist]);

  const handleCreatePlaylistCancel = () => {
    setShowCreatePlaylist(false);
    setNewPlaylistName("");
  };

  const handleDeletePlaylist = async (playlist: Playlist) => {
    // Check if user has chosen not to show delete confirmation
    const { musicIndexedDbHelper } = await import("../helpers/musicIndexedDbHelper");
    const shouldShow = await musicIndexedDbHelper.shouldShowDialog("delete-playlist-confirmation");
    if (!shouldShow) {
      // Delete directly without showing dialog
      removePlaylist(playlist.id);
      toast.success(t("playlist.playlistDeleted", { name: playlist.name }));
      return;
    }

    // Show confirmation dialog
    setPlaylistToDelete(playlist);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = useCallback(() => {
    if (!playlistToDelete) return;
    removePlaylist(playlistToDelete.id);
    toast.success(t("playlist.playlistDeleted", { name: playlistToDelete.name }));
    setIsDeleteDialogOpen(false);
    setPlaylistToDelete(null);
  }, [playlistToDelete, removePlaylist]);

  const handleSharePlaylist = useCallback((playlist: Playlist) => {
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
  }, []);

  const handleExportPlaylist = useCallback((playlist: Playlist, format: 'json' | 'm3u' = 'json') => {
    exportPlaylist(playlist, format);
  }, [exportPlaylist]);

  const getPlaylistIcon = useCallback((playlistName: string) => {
    if (playlistName.toLowerCase().includes("favorite")) {
      return <Icon name="heart" size={16} decorative />;
    }
    if (playlistName.toLowerCase().includes("made")) {
      return <Icon name="list" size={16} decorative />;
    }
    return <Icon name="music" size={16} decorative />;
  }, []);

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
          error && setIsDeleteDialogOpen(false); // Dummy usage to avoid lint error
        }
      }
    };
    input.click();
  };

  const handleMoveToFolder = useCallback((item: Playlist | PlaylistFolder) => {
    // Recursive function to get all folders
    const getAllFolders = (items: (Playlist | PlaylistFolder)[], path: string[] = []): { folder: PlaylistFolder; path: string[] }[] => {
      const folders: { folder: PlaylistFolder; path: string[] }[] = [];
      for (const item of items) {
        if ('children' in item) {
          folders.push({ folder: item, path: [...path] });
          folders.push(...getAllFolders(item.children, [...path, item.name]));
        }
      }
      return folders;
    };

    const allFolders = getAllFolders(library.playlists);
    if (allFolders.length === 0) {
      toast.error(t("playlist.noFoldersAvailable"));
      return;
    }
    setAvailableFolders(allFolders);
    setItemToMove(item);
    setShowMoveDialog(true);
  }, [library.playlists]);

  const handleRenameItem = useCallback((item: Playlist | PlaylistFolder) => {
    setItemToRename(item);
    setRenameValue(item.name);
    setShowRenameDialog(true);
  }, []);

  const playlistListRef = useRef<HTMLDivElement | null>(null);


  const renderPlaylistItem = (item: Playlist | PlaylistFolder, depth = 0) => {
    if ('songs' in item) {
      return <PlaylistItem key={item.id} item={item} depth={depth} />;
    } else {
      return <FolderItem key={item.id} item={item} depth={depth} renderPlaylistItem={renderPlaylistItem} />;
    }
  };

  const PlaylistItem = memo(({ item, depth }: { item: Playlist; depth: number }) => {
    const { open, setOpen, containerRef } = useRightClickMenu(true);

    return (
      <div
        data-id={item.id}
        className={styles.playlistItemContainer}
        style={{
          marginLeft: `${depth * 20}px`
        }}
        ref={containerRef}
      >
        <div className={styles.playlistItemMain}>
          <DraggableItem
            id={item.id}
            type="playlist"
            data={item}
          >
            <DropZone
              id={item.id}
              type="playlist"
              data={item}
              className={styles.playlistDropZone}
            >
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
                <div className={styles.playlistNameWrapper}>
                  <ScrollText
                    text={item.name}
                    textClassName={styles.playlistNameText}
                    gap={12}
                    speed={40}
                    minDuration={6}
                    pauseOnHover
                    allowHTML={false}
                  />
                </div>
                <span className={styles.songCount}>{item.songs.length}</span>
              </button>
            </DropZone>
          </DraggableItem>
        </div>

        <DropdownMenu key={`dropdown-${item.id}`} open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={styles.moreButton}
              title={t("moreOptions")}
            >
              <Icon name="moreHorizontal" size={16} decorative />
            </Button>
          </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuItem onClick={() => handleRenameItem(item)}>
                <Icon name="edit" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.renamePlaylist")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSharePlaylist(item)}>
                <Icon name="share" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.sharePlaylist")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleMoveToFolder(item)}>
                <Icon name="list" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.moveToFolder")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                moveToFolder(item.id, null); // Move to root
                toast.success(t("playlist.movedToRoot", { item: item.name }));
              }}>
                <Icon name="list" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.moveToRoot")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportPlaylist(item, 'json')}>
                <Icon name="download" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.exportJSON")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPlaylist(item, 'm3u')}>
                <Icon name="download" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.exportM3U")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeletePlaylist(item)}
                className={styles.deleteMenuItem}
              >
                <Icon name="trash2" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.deletePlaylist")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    );
  });

  const FolderItem = memo(({ item, depth, renderPlaylistItem }: { item: PlaylistFolder; depth: number; renderPlaylistItem: (item: Playlist | PlaylistFolder, depth: number) => JSX.Element }) => {
    const isOpen = openFolders.has(item.id);
    const { open, setOpen, containerRef } = useRightClickMenu(true);

    return (
      <Collapsible key={item.id} open={isOpen} onOpenChange={() => toggleFolder(item.id)}>
        <div 
          className={styles.playlistItemContainer} 
          style={{ marginLeft: `${depth * 20}px` }} 
          data-id={item.id}
          ref={containerRef}
        >
          {/* Folder header */}
          <div className={styles.playlistItemMain}>
            <DraggableItem
              id={item.id}
              type="folder"
              data={item}
            >
              <DropZone
                id={item.id}
                type="folder"
                data={item}
                className={styles.playlistDropZone}
              >
                <CollapsibleTrigger asChild>
                  <button className={`${styles.playlistItem} ${styles.folderItem}`} style={{ width: '100%' }}>
                    <Icon
                      name="chevronDown"
                      size={16}
                      className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                      decorative
                    />
                    <Icon name="list" size={16} decorative />
                    <div className={styles.playlistNameWrapper}>
                      <ScrollText
                        text={item.name}
                        textClassName={styles.playlistNameText}
                        gap={12}
                        speed={40}
                        minDuration={6}
                        pauseOnHover
                        allowHTML={false}
                      />
                    </div>
                    <span className={styles.songCount}>{item.children.length}</span>
                  </button>
                </CollapsibleTrigger>
              </DropZone>
            </DraggableItem>
          </div>

          <DropdownMenu key={`dropdown-${item.id}`} open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={styles.moreButton}
                title={t("moreOptions")}
              >
                <Icon name="moreHorizontal" size={16} decorative />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuItem onClick={() => handleRenameItem(item)}>
                <Icon name="edit" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.renameFolder")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleMoveToFolder(item)}>
                <Icon name="list" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.moveToFolder")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                moveToFolder(item.id, null); // Move to root
                toast.success(t("playlist.movedToRoot", { item: item.name }));
              }}>
                <Icon name="list" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.moveToRoot")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  // Check if user has chosen not to show delete confirmation
                  const { musicIndexedDbHelper } = await import("../helpers/musicIndexedDbHelper");
                  const shouldShow = await musicIndexedDbHelper.shouldShowDialog("delete-playlist-confirmation");
                  if (!shouldShow) {
                    // Delete directly without showing dialog
                    removePlaylist(item.id);
                    toast.success(t("playlist.folderDeleted", { name: item.name }));
                    return;
                  }

                  // Show confirmation dialog
                  setPlaylistToDelete(item);
                  setIsDeleteDialogOpen(true);
                }}
                className={styles.deleteMenuItem}
              >
                <Icon name="trash2" size={16} style={{ marginRight: 8 }} decorative />
                {t("playlist.deleteFolder")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent>
          <div>
            {item.children.map((child) => renderPlaylistItem(child, depth + 1))}
            {/* Empty folder styling handled by CSS now */}
            {item.children.length === 0 && (
              <div style={{
                height: 20,
                margin: '4px 0 4px 20px',
                color: '#999',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                Empty folder
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  });


  return (
    <div className={styles.playlistContainer}>
      <div className={styles.searchContainer}>
        <div className={styles.searchWrapper}>
          <div className={styles.searchIcon}>
            <Icon name="music" size={16} decorative />
          </div>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t("playlist.searchPlaylists")}
            value={playlistSearchQuery}
            onChange={(e: any) => handlePlaylistSearch(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-md" className={styles.actionButton} aria-label={t("playlist.add")}>
              <Icon name="plus" size={16} decorative />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuItem onClick={handleAddPlaylist}>
              <Icon name="plus" size={16} style={{ marginRight: 8 }} decorative />
              {t("playlist.addPlaylist")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowCreateFolderDialog(true)}>
              <Icon name="plus" size={16} style={{ marginRight: 8 }} decorative />
              {t("playlist.addFolder")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleImportPlaylist}>
              <Icon name="upload" size={16} style={{ marginRight: 8 }} decorative />
              {t("playlist.importPlaylist")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={playlistListRef} className={styles.playlistList} style={{ position: 'relative' }}>
        {/* All Songs */}
        <button
          className={`${styles.playlistItem} ${styles.allSongsItem}`}
          onClick={handleAllSongsClick}
        >
          <Icon name="music" size={16} decorative />
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
          <Icon name="heart" size={16} decorative />
          {t("favorites.favorites")}
          <span className={styles.songCount}>{library.favorites.length}</span>
        </button>

        {/* User playlists and folders */}
        {filteredPlaylists.map((item) => renderPlaylistItem(item))}

        {filteredPlaylists.length === 0 && playlistSearchQuery && (
          <div className={styles.noResults}>{t("noPlaylistsFound")}</div>
        )}
      </div>

      {/* Create Playlist Modal */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("playlist.createPlaylist")}</DialogTitle>
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

      {/* Move to Folder Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("playlist.moveToFolder")}</DialogTitle>
            <DialogDescription>
              {t("playlist.selectFolderToMove", { item: itemToMove?.name })}
            </DialogDescription>
          </DialogHeader>
          <div className={modalStyles.spaceY4}>
            {availableFolders.map(({ folder, path }) => (
              <Button
                key={folder.id}
                variant="outline"
                className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
                onClick={() => {
                  if (itemToMove) moveToFolder(itemToMove.id, folder.id);
                  toast.success(t("playlist.movedToFolder", { item: itemToMove?.name, folder: folder.name }));
                  setShowMoveDialog(false);
                  setItemToMove(null);
                }}
              >
                {path.length > 0 ? `${path.join(" / ")} / ${folder.name}` : folder.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemToRename && 'songs' in itemToRename ? t("playlist.renamePlaylist") : t("playlist.renameFolder")}</DialogTitle>
            <DialogDescription>
              {t("playlist.enterNewName")}
            </DialogDescription>
          </DialogHeader>
          <div className={modalStyles.spaceY4}>
            <Input
              placeholder={t("playlist.enterName")}
              value={renameValue}
              onChange={(e: any) => setRenameValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => {
              if (itemToRename && renameValue.trim()) {
                itemToRename.name = renameValue.trim();
                toast.success(itemToRename && 'songs' in itemToRename ? t("playlist.playlistRenamed", { name: renameValue.trim() }) : t("playlist.folderRenamed", { name: renameValue.trim() }));
                setShowRenameDialog(false);
                setItemToRename(null);
                setRenameValue("");
              }
            }}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent dontShowAgainKey="delete-playlist-confirmation">
          <DialogHeader>
            <DialogTitle>{playlistToDelete && 'songs' in playlistToDelete ? t("playlist.deletePlaylist") : t("playlist.deleteFolder")}</DialogTitle>
            <DialogDescription>
              {playlistToDelete
                ? ('songs' in playlistToDelete
                  ? t("playlist.deletePlaylistConfirmation", { name: playlistToDelete.name })
                  : t("playlist.deleteFolderConfirmation", { name: playlistToDelete.name }))
                : ""}
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

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("playlist.createFolder")}</DialogTitle>
            <DialogDescription>
              {t("playlist.enterFolderName")}
            </DialogDescription>
          </DialogHeader>
          <div className={modalStyles.spaceY4}>
            <Input
              placeholder={t("playlist.folderName")}
              value={newFolderName}
              onChange={(e: any) => setNewFolderName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateFolderDialog(false);
              setNewFolderName("");
            }}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => {
              if (newFolderName.trim()) {
                createFolder(newFolderName.trim());
                toast.success(t("playlist.folderCreated", { name: newFolderName.trim() }));
                setShowCreateFolderDialog(false);
                setNewFolderName("");
              }
            }}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(PlaylistComponent, (prevProps, nextProps) => {
  // Only re-render if the library playlists or songs have actually changed
  return (
    prevProps.musicPlayerHook.library.playlists === nextProps.musicPlayerHook.library.playlists &&
    prevProps.musicPlayerHook.library.songs === nextProps.musicPlayerHook.library.songs &&
    prevProps.musicPlayerHook.library.favorites === nextProps.musicPlayerHook.library.favorites
  );
});
