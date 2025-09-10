import React, { useState } from "react";
import {
  Search,
  Trash2,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Heart,
  PlusCircle,
  ListChecks,
} from "lucide-react";
import { SongActionsDropdown } from "./SongActionsDropdown";
import { Checkbox } from "./Checkbox";
import {
  pickAudioFiles,
  extractAudioMetadata,
  createAudioUrl,
  generateUniqueId,
} from "../helpers/filePickerHelper";
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

import { Song } from "../helpers/musicPlayerHook";
import styles from "./MainContent.module.css";
import PersistentDropdownMenu from "./PersistentDropdownMenu";

type MainContentProps = {
  musicPlayerHook: ReturnType<
    typeof import("../helpers/musicPlayerHook").useMusicPlayer
  >;
};

export const MainContent = ({ musicPlayerHook }: MainContentProps) => {
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [ratings, setRatings] = useState<
    Record<string, "thumbs-up" | "thumbs-down" | "none">
  >({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [showSongInfo, setShowSongInfo] = useState(false);
  const [selectedSongInfo] = useState<Song | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [isSelectSongsActive, setIsSelectSongsActive] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const {
    playerState,
    library,
    playSong,
    addSong,
    removeSong,
    toggleFavorite,
    isFavorited,
    createPlaylist,
    addToPlaylist,
    navigateToArtist,
    navigateToAlbum,
    navigateToSongs,
  } = musicPlayerHook;

  // Add navigation event listener
  React.useEffect(() => {
    const handleNavigate = (
      e: CustomEvent<{ view: "artist" | "album"; value: string }>
    ) => {
      if (e.detail.view === "artist") {
        navigateToArtist(e.detail.value);
      } else if (e.detail.view === "album") {
        navigateToAlbum(e.detail.value);
      }
    };

    window.addEventListener("navigate", handleNavigate);
    return () =>
      window.removeEventListener("navigate", handleNavigate);
  }, [navigateToArtist, navigateToAlbum]);

  // Get initial songs list based on current view
  const songsToDisplay = React.useMemo(() => {
    if (playerState.view === "artist" && playerState.currentArtist) {
      return library.songs.filter(
        (song) => song.artist === playerState.currentArtist
      );
    } else if (playerState.view === "album" && playerState.currentAlbum) {
      return library.songs.filter(
        (song) => song.album === playerState.currentAlbum
      );
    } else if (playerState.currentPlaylist) {
      return playerState.currentPlaylist.songs;
    } else {
      return library.songs;
    }
  }, [
    playerState.view,
    playerState.currentArtist,
    playerState.currentAlbum,
    playerState.currentPlaylist,
    library.songs,
  ]);

  // Filter songs based on search
  const filteredSongs = songsToDisplay.filter(
    (song: Song) =>
      song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(songSearchQuery.toLowerCase())
  );

  const handleSongSearch = (query: string) => {
    setSongSearchQuery(query);
  };

  const handleSongClick = (song: Song) => {
    playSong(song, playerState.currentPlaylist || undefined);
  };

  const handleRating = (
    songId: string,
    rating: "thumbs-up" | "thumbs-down"
  ) => {
    const currentRating = ratings[songId];
    const newRating = currentRating === rating ? "none" : rating;
    setRatings((prev) => ({ ...prev, [songId]: newRating }));
  };

  const handleToggleFavorite = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    songId: string
  ) => {
    e.stopPropagation();
    const wasAdded = toggleFavorite(songId);

    // Show toast notification
    const song = library.songs.find((s) => s.id === songId);
    if (song) {
      if (wasAdded) {
        toast.success(`Added "${song.title}" to favorites`);
      } else {
        toast.success(`Removed "${song.title}" from favorites`);
      }
    }
  };

  const handleDeleteSong = () => {
    if (filteredSongs.length === 0) {
      toast.error("No songs to delete");
      return;
    }

    const songToDelete = filteredSongs[0]; // Delete first song as example
    setSongToDelete(songToDelete);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (songToDelete) {
      removeSong(songToDelete.id);
      toast.success(`Deleted "${songToDelete.title}"`);
      setShowDeleteConfirm(false);
      setSongToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setSongToDelete(null);
  };

  const handleAddMusic = async () => {
    try {
      toast.info("Select audio files to import...");
      const audioFiles = await pickAudioFiles();

      if (audioFiles.length === 0) {
        return;
      }

      const BATCH_SIZE = 7; // Process 7 files at a time
      let successCount = 0;
      let errorCount = 0;
      let currentBatch = 1;
      const totalBatches = Math.ceil(audioFiles.length / BATCH_SIZE);

      // Process files in batches
      for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
        const batch = audioFiles.slice(i, i + BATCH_SIZE);
        toast.loading(`Processing batch ${currentBatch} of ${totalBatches}...`);

        // Process current batch
        const batchPromises = batch.map(async (audioFile) => {
          try {
            console.log(`Processing file: ${audioFile.name}`);

            const metadata = await extractAudioMetadata(audioFile.file);
            const audioUrl = createAudioUrl(audioFile.file);

            const song: Song = {
              id: generateUniqueId(),
              title: metadata.title,
              artist: metadata.artist,
              album: metadata.album || "Unknown Album",
              duration: metadata.duration,
              url: audioUrl,
              albumArt: metadata.albumArt,
            };

            await addSong(song);
            successCount++;
            console.log(`Successfully processed: ${song.title}`);
          } catch (error) {
            console.error(`Failed to process ${audioFile.name}:`, error);
            errorCount++;
          }
        });

        // Wait for current batch to complete
        await Promise.all(batchPromises);
        currentBatch++;
      }

      toast.dismiss();

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} song(s)`);
      }

      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} file(s)`);
      }
    } catch (error) {
      console.error("File picker error:", error);
      toast.dismiss();
      toast.error("Failed to open file picker");
    }
  };
  const formatDuration = (seconds: number) => {
    const roundedSeconds = Math.round(seconds);
    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectSongsToggle = () => {
    setIsSelectSongsActive((prev) => !prev);
    setSelectedSongs([]);
  };

  const handleSelectAll = () => {
    if (selectedSongs.length === filteredSongs.length) {
      setSelectedSongs([]);
    } else {
      setSelectedSongs(filteredSongs.map((song) => song.id));
    }
  };

  const handleAddToPlaylist = () => {
    setShowPlaylistDialog(true);
  };

  const handleCreateNewPlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast.error("Please enter a playlist name");
      return;
    }
    const newPlaylist = createPlaylist(
      newPlaylistName,
      selectedSongs
        .map((songId) => library.songs.find((s) => s.id === songId))
        .filter((song): song is Song => song !== undefined)
    );
    toast.success(
      `Created new playlist "${newPlaylist.name}" and added ${selectedSongs.length} songs`
    );
    setNewPlaylistName("");
    setIsCreatingNew(false);
    setShowPlaylistDialog(false);
  };

  const handleAddToExistingPlaylist = (playlistId: string) => {
    selectedSongs.forEach((songId) => {
      addToPlaylist(playlistId, songId);
    });
    toast.success(`Added ${selectedSongs.length} songs to playlist`);
    setShowPlaylistDialog(false);
  };

  const handleDeleteSelectedSongs = () => {
    selectedSongs.forEach((songId) => {
      removeSong(songId);
    });
    toast.success(`Deleted ${selectedSongs.length} songs`);
    setSelectedSongs([]);
  };

  return (
    <div className={styles.mainContentWrapper}>
      {/* Persistent Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          {playerState.view === "songs" ? (
            <h1 className={styles.title}>HTMLPlayer</h1>
          ) : playerState.view === "artist" ? (
            <>
              <Button variant="link" onClick={navigateToSongs} className={styles.backLink}>All Songs</Button>
              <h1 className={styles.title}>Artist: {playerState.currentArtist}</h1>
            </>
          ) : playerState.view === "album" ? (
            <>
              <Button variant="link" onClick={navigateToSongs} className={styles.backLink}>All Songs</Button>
              <h1 className={styles.title}>Album: {playerState.currentAlbum}</h1>
            </>
          ) : null}
        </div>
        <div className={styles.actions}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} size={16} />
            <Input
              placeholder="Search songs..."
              className={styles.searchInput}
              value={songSearchQuery}
              onChange={(e: any) => handleSongSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon-md" className={styles.actionButton} onClick={handleDeleteSong} title="Delete first song"><Trash2 size={16} /></Button>
          <PersistentDropdownMenu
            trigger={
              <Button variant="outline" size="icon-md" className={styles.actionButton} title="Select songs" onClick={handleSelectSongsToggle}><ListChecks size={16} /></Button>
            }
            onClose={() => handleSelectSongsToggle()}
          >
            <Button variant="ghost" onClick={handleSelectAll}>{selectedSongs.length === filteredSongs.length ? "Deselect All" : "Select All"}</Button>
            <Button variant="ghost" onClick={handleAddToPlaylist}>Add to playlist</Button>
            <Button variant="ghost" onClick={handleDeleteSelectedSongs}>Delete song(s)</Button>
          </PersistentDropdownMenu>
          <Button variant="outline" size="icon-md" className={styles.actionButton} onClick={handleAddMusic} title="Add music files"><Plus size={16} /></Button>
        </div>
      </div>

      {/* Scrollable Song List */}
      <div className={styles.songListWrapper}>
        <div className={styles.songList}>
          <div className={styles.songListHeader}>
            <span className={styles.columnHeader}>Song</span>
            <span className={styles.columnHeader}>Artist</span>
            <span className={styles.columnHeader}>Actions</span>
          </div>

          {filteredSongs.map((song: Song) => (
            <div
              key={song.id}
              className={`${styles.songItem} ${playerState.currentSong?.id === song.id ? styles.currentSong : ""}`}
              onClick={() => handleSongClick(song)}
            >
              <div className={styles.songInfo}>
                {isSelectSongsActive && (
                  <Checkbox
                    checked={selectedSongs.includes(song.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedSongs(prev =>
                        prev.includes(song.id) ? prev.filter(id => id !== song.id) : [...prev, song.id]
                      );
                    }}
                  />
                )}
                <div className={styles.albumArt}>
                  {song.albumArt && <img src={song.albumArt} alt={`${song.title} album art`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />}
                </div>
                <div className={styles.songDetails}>
                  <div className={styles.songTitle}>{song.title}</div>
                  <div className={styles.songArtist}>{song.artist} • {formatDuration(song.duration)}</div>
                </div>
              </div>
              <div className={styles.artistName}>{song.artist}</div>
              <div className={styles.songActions}>
                <Button variant="ghost" size="icon-sm" className={`${styles.songActionButton} ${isFavorited(song.id) ? styles.favorited : ""}`} onClick={(e: any) => handleToggleFavorite(e, song.id)}>
                  <Heart size={14} fill={isFavorited(song.id) ? "currentColor" : "none"} />
                </Button>
                <Button variant="ghost" size="icon-sm" className={`${styles.songActionButton} ${ratings[song.id] === "thumbs-up" ? styles.active : ""}`} onClick={() => handleRating(song.id, "thumbs-up")}><ThumbsUp size={14} /></Button>
                <Button variant="ghost" size="icon-sm" className={`${styles.songActionButton} ${ratings[song.id] === "thumbs-down" ? styles.active : ""}`} onClick={() => handleRating(song.id, "thumbs-down")}><ThumbsDown size={14} /></Button>
                <SongActionsDropdown song={song} library={library} onCreatePlaylist={createPlaylist} onAddToPlaylist={addToPlaylist} onRemoveSong={removeSong} onPlaySong={playSong} size={14} className={styles.songActionButton} />
              </div>
            </div>
          ))}

          {filteredSongs.length === 0 && (
            <div className={styles.noResults}>{songSearchQuery ? "No songs found" : "No songs in this playlist"}</div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Song</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{songToDelete?.title}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Song Info Modal */}
      <Dialog open={showSongInfo} onOpenChange={setShowSongInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Song Information</DialogTitle>
          </DialogHeader>
          {selectedSongInfo && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-3)",
              }}
            >
              <div>
                <strong>Title:</strong> {selectedSongInfo.title}
              </div>
              <div>
                <strong>Artist:</strong> {selectedSongInfo.artist}
              </div>
              <div>
                <strong>Album:</strong> {selectedSongInfo.album}
              </div>
              <div>
                <strong>Duration:</strong>{" "}
                {formatDuration(selectedSongInfo.duration)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowSongInfo(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Playlist Dialog */}
      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Playlist</DialogTitle>
            <DialogDescription>
              Choose a playlist to add the selected songs to, or create a new
              one.
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
                          onClick={() =>
                            handleAddToExistingPlaylist(playlist.id)
                          }
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
    </div>
  );
};
