import React, { useState, useEffect } from "react";
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
import { Song, Playlist } from "../helpers/musicPlayerHook";
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
    typeof import("../helpers/musicPlayerHook").useMusicPlayer
  >;
};

export const PlaylistComponent = ({ musicPlayerHook }: PlaylistProps) => {
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

  // Generate playlist images when songs change
  useEffect(() => {
    const updatePlaylistImages = async () => {
      const newImages: Record<string, string> = {};

      for (const playlist of library.playlists) {
        if (playlist.id === "all-songs") continue;
        const image = await generatePlaylistImage(playlist.songs);
        if (image) {
          newImages[playlist.id] = image;
        }
      }

      setPlaylistImages(newImages);
    };

    updatePlaylistImages();
  }, [library.playlists, library.songs]);

  // Filter playlists based on search, excluding All Songs playlist
  const filteredPlaylists = library.playlists.filter(
    (playlist: Playlist) =>
      playlist.id !== "all-songs" &&
      playlist.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
  );

  const handlePlaylistSearch = (query: string) => {
    setPlaylistSearchQuery(query);
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    if (playlist.songs.length > 0) {
      playSong(playlist.songs[0], playlist);
    }
  };

  const handleAllSongsClick = () => {
    // Find existing All Songs playlist or create a new one
    const existingAllSongs = library.playlists.find(
      (p) => p.id === "all-songs"
    );
    if (existingAllSongs) {
      // Use existing All Songs playlist
      if (existingAllSongs.songs.length > 0) {
        playSong(existingAllSongs.songs[0], existingAllSongs);
      }
    } else if (library.songs.length > 0) {
      // Create new All Songs playlist if it doesn't exist
      const allSongsPlaylist: Playlist = {
        id: "all-songs",
        name: "All Songs",
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
    if (newPlaylistName && newPlaylistName.trim()) {
      if (editingPlaylistId) {
        // Update existing playlist
        const playlist = library.playlists.find(
          (p) => p.id === editingPlaylistId
        );
        if (playlist) {
          playlist.name = newPlaylistName.trim();
          toast.success(`Playlist renamed to "${newPlaylistName.trim()}"`);
        }
      } else {
        // Create new playlist
        createPlaylist(newPlaylistName.trim());
        toast.success(`Created new playlist "${newPlaylistName.trim()}"`);
      }
      setShowCreatePlaylist(false);
      setNewPlaylistName("");
      setEditingPlaylistId(null);
    }
  };

  const handleCreatePlaylistCancel = () => {
    setShowCreatePlaylist(false);
    setNewPlaylistName("");
  };

  const handleEditPlaylist = (playlist: Playlist) => {
    setNewPlaylistName(playlist.name);
    setShowCreatePlaylist(true);
    // Store the playlist being edited
    setEditingPlaylistId(playlist.id);
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    setPlaylistToDelete(playlist);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (playlistToDelete) {
      removePlaylist(playlistToDelete.id);
      toast.success(`Deleted playlist "${playlistToDelete.name}"`);
      setIsDeleteDialogOpen(false);
      setPlaylistToDelete(null);
    }
  };

  const handleSharePlaylist = (playlist: Playlist) => {
    const shareData = {
      title: `Playlist: ${playlist.name}`,
      text: `Check out this playlist "${playlist.name}" with ${playlist.songs.length} songs`,
      url: window.location.href,
    };

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare(shareData)
      ) {
        navigator.share(shareData);
        toast.success("Playlist shared successfully");
      } else {
        navigator.clipboard.writeText(
          `${shareData.title}\n${shareData.text}\n${shareData.url}`
        );
        toast.success("Playlist info copied to clipboard!");
      }
    } catch (error) {
      console.error("Failed to share:", error);
      toast.error("Failed to share playlist");
    }
  };

  const getPlaylistIcon = (playlistName: string) => {
    if (playlistName.toLowerCase().includes("favorite"))
      return <Heart size={16} />;
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
            placeholder="Search playlists..."
            value={playlistSearchQuery}
            onChange={(e) => handlePlaylistSearch(e.target.value)}
          />
        </div>
      </div>
      <div>
        <button
          className={`${styles.playlistItem} ${styles.addPlaylistButton}`}
          onClick={handleAddPlaylist}
        >
          <Plus size={16} />
          Add Playlist
        </button>
      </div>

      <div className={styles.playlistList}>
        {/* Fixed All Songs Playlist */}
        {library.playlists.find((p) => p.id === "all-songs") ? (
          <button
            className={`${styles.playlistItem} ${styles.allSongsItem}`}
            onClick={() =>
              handlePlaylistSelect(
                library.playlists.find((p) => p.id === "all-songs")!
              )
            }
          >
            <Music size={16} />
            All Songs
            <span className={styles.songCount}>{library.songs.length}</span>
          </button>
        ) : (
          <button
            className={`${styles.playlistItem} ${styles.allSongsItem}`}
            onClick={handleAllSongsClick}
          >
            <Music size={16} />
            All Songs
            <span className={styles.songCount}>{library.songs.length}</span>
          </button>
        )}

        <button
          className={`${styles.playlistItem} ${styles.favoritesItem}`}
          onClick={() =>
            handlePlaylistSelect({
              id: "favorites",
              name: "Favorites",
              songs: library.songs.filter((song) =>
                library.favorites.includes(song.id)
              ),
            })
          }
        >
          <Heart size={16} />
          Favorites
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
                  title="More options"
                >
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8}>
                <DropdownMenuItem onClick={() => handleEditPlaylist(playlist)}>
                  <Edit size={16} style={{ marginRight: 8 }} />
                  Edit playlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSharePlaylist(playlist)}>
                  <Share size={16} style={{ marginRight: 8 }} />
                  Share playlist
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeletePlaylist(playlist)}
                  className={styles.deleteMenuItem}
                >
                  <Trash2 size={16} style={{ marginRight: 8 }} />
                  Delete playlist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        {filteredPlaylists.length === 0 && playlistSearchQuery && (
          <div className={styles.noResults}>No playlists found</div>
        )}
      </div>

      {/* Create Playlist Modal */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Playlist</DialogTitle>
            <DialogDescription>
              Enter a name for your new playlist
            </DialogDescription>
          </DialogHeader>
          <div style={{ margin: "var(--spacing-4) 0" }}>
            <Input
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e: any) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === "Enter") {
                  handleCreatePlaylistConfirm();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCreatePlaylistCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePlaylistConfirm}
              disabled={!newPlaylistName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Playlist Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Playlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the playlist "
              {playlistToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
