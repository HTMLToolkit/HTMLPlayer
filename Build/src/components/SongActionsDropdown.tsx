import { useState } from "react";
import {
  Plus,
  Info,
  Share,
  User,
  Music,
  MoreHorizontal,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import modalStyles from "./Dialog.module.css";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { Song } from "../types/Song";
import { Playlist } from "../types/Playlist";
import { MusicLibrary } from "../types/MusicLibrary";

interface SongActionsDropdownProps {
  song: Song;
  library: MusicLibrary;
  onCreatePlaylist: (name: string, songs: Song[]) => Playlist;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  onRemoveSong: (songId: string) => void;
  onPlaySong: (song: Song, playlist?: Playlist) => void;
  size?: number;
  className?: string;
}

export const SongActionsDropdown = ({
  song,
  library,
  onCreatePlaylist,
  onAddToPlaylist,
  onRemoveSong,
  size = 16,
  className = "",
}: SongActionsDropdownProps) => {
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const handleAddToPlaylist = (playlist?: Playlist) => {
    if (playlist) {
      const isAlreadyInPlaylist = playlist.songs.some((s) => s.id === song.id);
      if (isAlreadyInPlaylist) {
        toast.info(`"${song.title}" is already in playlist "${playlist.name}"`);
      } else {
        onAddToPlaylist(playlist.id, song.id);
        toast.success(`Added "${song.title}" to playlist "${playlist.name}"`);
      }
    }
    setShowPlaylistDialog(false);
  };

  const handleCreateNewPlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast.error("Please enter a playlist name");
      return;
    }
    const newPlaylist = onCreatePlaylist(newPlaylistName, [song]);
    toast.success(
      `Created new playlist "${newPlaylist.name}" and added "${song.title}"`
    );
    setNewPlaylistName("");
    setIsCreatingNew(false);
    setShowPlaylistDialog(false);
  };

  const formatTime = (seconds: number) => {
    const roundedSeconds = Math.round(seconds);
    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleShowSongInfo = () => {
    setShowInfoDialog(true);
  };

  const handleShare = async () => {
    const shareData = {
      title: `${song.title} - ${song.artist}`,
      text: `Listen to "${song.title}" by ${song.artist}`,
      url: window.location.href,
    };

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData);
        toast.success("Song shared successfully");
      } else {
        const shareText = `🎵 ${shareData.title}\n${shareData.text}\n${shareData.url}`;
        await navigator.clipboard.writeText(shareText);
        toast.success("Song info copied to clipboard!");
      }
    } catch (error) {
      console.error("Failed to share:", error);
      try {
        await navigator.clipboard.writeText(`${song.title} by ${song.artist}`);
        toast.success("Song info copied to clipboard");
      } catch (clipboardError) {
        console.error("Failed to copy to clipboard:", clipboardError);
        toast.error("Failed to share or copy song info");
      }
    }
  };

  const handleGoToArtist = () => {
    window.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { view: "artist", value: song.artist },
      })
    );
  };

  const handleGoToAlbum = () => {
    window.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { view: "album", value: song.album },
      })
    );
  };

  const handleDeleteSong = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onRemoveSong(song.id);
    toast.success(`Deleted "${song.title}" from the library`);
    setShowDeleteDialog(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={className}
          title="More options"
        >
          <MoreHorizontal size={size} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem onClick={() => setShowPlaylistDialog(true)}>
          <Plus size={size} style={{ marginRight: 8 }} />
          Add to playlist
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShowSongInfo}>
          <Info size={size} style={{ marginRight: 8 }} />
          Song info
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShare}>
          <Share size={size} style={{ marginRight: 8 }} />
          Share
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleGoToArtist}>
          <User size={size} style={{ marginRight: 8 }} />
          Go to artist
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleGoToAlbum}>
          <Music size={size} style={{ marginRight: 8 }} />
          Go to album
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDeleteSong}
          className={modalStyles.delete}
        >
          <Trash2 size={size} style={{ marginRight: 8 }} />
          Delete from library
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Song</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{song.title}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Playlist Dialog */}
      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Playlist</DialogTitle>
            <DialogDescription>
              Choose a playlist to add "{song.title}" to, or create a new one.
            </DialogDescription>
          </DialogHeader>

          {isCreatingNew ? (
            <div className={modalStyles.spaceY4}>
              <Input
                placeholder="Enter playlist name..."
                value={newPlaylistName}
                onChange={(e: any) => setNewPlaylistName(e.target.value)}
              />
              <div className={`${modalStyles.flex} ${modalStyles.gap2}`}>
                <Button
                  variant="outline"
                  onClick={() => setIsCreatingNew(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateNewPlaylist}>
                  Create Playlist
                </Button>
              </div>
            </div>
          ) : (
            <div className={modalStyles.spaceY4}>
              {library.playlists.filter((p) => p.id !== "all-songs").length >
              0 ? (
                <div className={modalStyles.spaceY2}>
                  {library.playlists
                    .filter((playlist) => playlist.id !== "all-songs")
                    .map((playlist) => (
                      <div
                        key={playlist.name}
                        className={`${modalStyles.flex} ${modalStyles.gap2}`}
                      >
                        <Button
                          variant="outline"
                          className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
                          onClick={() => handleAddToPlaylist(playlist)}
                        >
                          {playlist.name}
                        </Button>
                      </div>
                    ))}
                </div>
              ) : (
                <p className={modalStyles.muted}>
                  No playlists yet. Create your first one!
                </p>
              )}

              <Button
                variant="outline"
                className={modalStyles["w-full"]}
                onClick={() => setIsCreatingNew(true)}
              >
                <PlusCircle size={16} className="mr-2" />
                Create New Playlist
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Song Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Song Information</DialogTitle>
            <DialogDescription>
              Detailed information about the song.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", gap: "var(--spacing-4)" }}>
            {song.albumArt && (
              <img
                src={song.albumArt}
                alt={song.album}
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "cover",
                  borderRadius: "var(--radius-2)",
                }}
              />
            )}
            <div className={modalStyles.spaceY4}>
              <p>
                <strong>Title:</strong> {song.title}
              </p>
              <p>
                <strong>Artist:</strong> {song.artist}
              </p>
              <p>
                <strong>Album:</strong> {song.album}
              </p>
              <p>
                <strong>Duration:</strong> {formatTime(song.duration)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInfoDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};
