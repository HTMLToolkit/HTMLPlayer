import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Heart,
  List,
  Music,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Share,
} from "lucide-react";
import { toast } from "sonner";
import styles from "./Playlist.module.css";
import { Playlist } from "../hooks/musicPlayerHook";
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

  const { library, playSong, createPlaylist, removePlaylist } = musicPlayerHook;

  useEffect(() => {
    const updatePlaylistImages = async () => {
      const newImages: Record<string, string> = {};
      for (const playlist of library.playlists) {
        if (playlist.id === "all-songs") continue;
        const image = await generatePlaylistImage(playlist.songs);
        if (image) newImages[playlist.id] = image;
      }
      setPlaylistImages(newImages);
    };
    updatePlaylistImages();
  }, [library.playlists, library.songs]);

  const filteredPlaylists = library.playlists.filter(
    (playlist: Playlist) =>
      playlist.id !== "all-songs" &&
      playlist.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
  );

  const handlePlaylistSearch = (query: string) => setPlaylistSearchQuery(query);

  const handlePlaylistSelect = (playlist: Playlist) => {
    if (playlist.songs.length > 0) playSong(playlist.songs[0], playlist);
  };

  const handleAllSongsClick = () => {
    const existingAllSongs = library.playlists.find((p) => p.id === "all-songs");
    if (existingAllSongs && existingAllSongs.songs.length > 0) {
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
          t("playlistRenamed", { name: newPlaylistName.trim() })
        );
      }
    } else {
      createPlaylist(newPlaylistName.trim());
      toast.success(
        t("playlistCreated", { name: newPlaylistName.trim() })
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
    toast.success(t("playlistDeleted", { name: playlistToDelete.name }));
    setIsDeleteDialogOpen(false);
    setPlaylistToDelete(null);
  };

  const handleSharePlaylist = (playlist: Playlist) => {
    const shareData = {
      title: t("playlistShareTitle", { name: playlist.name }),
      text: t("playlistShareText", {
        name: playlist.name,
        count: playlist.songs.length,
      }),
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        navigator.share(shareData);
        toast.success(t("playlistShared"));
      } else {
        navigator.clipboard.writeText(
          `${shareData.title}\n${shareData.text}\n${shareData.url}`
        );
        toast.success(t("playlistCopied"));
      }
    } catch {
      toast.error(t("playlistShareFailed"));
    }
  };

  const getPlaylistIcon = (playlistName: string) => {
    if (playlistName.toLowerCase().includes("favorite")) return <Heart size={16} />;
    if (playlistName.toLowerCase().includes("made")) return <List size={16} />;
    return <Music size={16} />;
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
            placeholder={t("searchPlaylists")}
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
          {t("addPlaylist")}
        </button>
      </div>

      <div className={styles.playlistList}>
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

        {filteredPlaylists.map((playlist: Playlist) => (
          <div key={playlist.id} className={styles.playlistItemContainer}>
            <button
              className={styles.playlistItem}
              onClick={() => handlePlaylistSelect(playlist)}
            >
              {playlistImages[playlist.id] ? (
                <div className={styles.playlistImage}>
                  <img src={playlistImages[playlist.id]} alt="" loading="lazy" />
                </div>
              ) : (
                getPlaylistIcon(playlist.name)
              )}
              {playlist.name}
              <span className={styles.songCount}>{playlist.songs.length}</span>
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
                <DropdownMenuItem onClick={() => handleEditPlaylist(playlist)}>
                  <Edit size={16} style={{ marginRight: 8 }} />
                  {t("editPlaylist")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSharePlaylist(playlist)}>
                  <Share size={16} style={{ marginRight: 8 }} />
                  {t("sharePlaylist")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeletePlaylist(playlist)}
                  className={styles.deleteMenuItem}
                >
                  <Trash2 size={16} style={{ marginRight: 8 }} />
                  {t("deletePlaylist")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        {filteredPlaylists.length === 0 && playlistSearchQuery && (
          <div className={styles.noResults}>{t("noPlaylistsFound")}</div>
        )}
      </div>

      {/* Create Playlist Modal */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlaylistId ? t("editPlaylist") : t("createPlaylist")}</DialogTitle>
            <DialogDescription>
              {t("enterPlaylistName")}
            </DialogDescription>
          </DialogHeader>
          <div style={{ margin: "var(--spacing-4) 0" }}>
            <Input
              placeholder={t("playlistName")}
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
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreatePlaylistConfirm}
              disabled={!newPlaylistName.trim()}
            >
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Playlist Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deletePlaylist")}</DialogTitle>
            <DialogDescription>
              {t("deletePlaylistConfirmation", { name: playlistToDelete?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>{t("delete.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
