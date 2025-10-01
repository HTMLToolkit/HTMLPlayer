import React, { useState } from "react";
import {
  Search,
  Trash2,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Heart,
  PlusCircle,
  Music,
  ListChecks,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Type,
  User,
  Disc,
  Star,
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
import styles from "./MainContent.module.css";
import PersistentDropdownMenu, { PersistentDropdownMenuRef } from "./PersistentDropdownMenu";
import { useTranslation } from "react-i18next";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableSongItemProps {
  song: Song;
  isCurrent: boolean;
  isSelected: boolean;
  onClick: () => void;
  onCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSelectActive: boolean;
  ratings: Record<string, "thumbs-up" | "thumbs-down" | "none">;
  onRatingChange: (rating: "thumbs-up" | "thumbs-down") => void;
  onFavoriteToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isFavorited: boolean;
  formatDuration: (seconds: number) => string;
  styles: any;
  SongActionsDropdown: any;
  library: MusicLibrary;
  createPlaylist: (name: string) => void;
  addToPlaylist: (playlistId: string, songId: string) => void;
  playSong: (song: Song, playlist?: Playlist) => void;
  removeSong: (songId: string) => void;
}

const SortableSongItem = ({
  song,
  isCurrent,
  isSelected,
  onClick,
  onCheckboxChange,
  isSelectActive,
  ratings,
  onRatingChange,
  onFavoriteToggle,
  isFavorited,
  formatDuration,
  styles,
  SongActionsDropdown,
  library,
  createPlaylist,
  addToPlaylist,
  playSong,
  removeSong,
}: SortableSongItemProps) => {
  const { t } = useTranslation();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `song-${song.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.songItem} ${isCurrent ? styles.currentSong : ""}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className={styles.songInfo}>
        {isSelectActive && (
          <Checkbox
            checked={isSelected}
            onChange={onCheckboxChange}
          />
        )}
        <div className={styles.albumArt}>
          {song.albumArt && <img src={song.albumArt} alt={t("player.albumArtAlt", { title: song.title })} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />}
        </div>
        <div className={styles.songDetails}>
          <div className={styles.songTitle}>{song.title}</div>
          <div className={styles.songArtist}>{song.artist} • {formatDuration(song.duration)}</div>
        </div>
      </div>
      <div className={styles.albumName}>{song.album || t("common.unknownAlbum")}</div>
      <div className={styles.songActions}>
        <Button variant="ghost" size="icon-sm" className={`${styles.songActionButton} ${isFavorited ? styles.favorited : ""}`} onClick={onFavoriteToggle}>
          <Heart size={14} fill={isFavorited ? "currentColor" : "none"} />
        </Button>
        <Button variant="ghost" size="icon-sm" className={`${styles.songActionButton} ${ratings[song.id] === "thumbs-up" ? styles.active : ""}`} onClick={() => onRatingChange("thumbs-up")}><ThumbsUp size={14} /></Button>
        <Button variant="ghost" size="icon-sm" className={`${styles.songActionButton} ${ratings[song.id] === "thumbs-down" ? styles.active : ""}`} onClick={() => onRatingChange("thumbs-down")}><ThumbsDown size={14} /></Button>
        <SongActionsDropdown song={song} library={library} onCreatePlaylist={createPlaylist} onAddToPlaylist={addToPlaylist} onRemoveSong={removeSong} onPlaySong={playSong} size={14} className={styles.songActionButton} />
      </div>
    </div>
  );
};

interface MainContentProps {
  musicPlayerHook: ReturnType<
    typeof import("../hooks/musicPlayerHook").useMusicPlayer
  >;
}

export const MainContent = ({ musicPlayerHook }: MainContentProps) => {
  const { t } = useTranslation();



  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "artist" | "album" | "rating" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
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
  const sortDropdownRef = React.useRef<PersistentDropdownMenuRef>(null);

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
    reorderPlaylistSongs,
    navigateToArtist,
    navigateToAlbum,
    navigateToSongs,
  } = musicPlayerHook;

  // Navigation listener
  React.useEffect(() => {
    const handleNavigate = (
      e: CustomEvent<{ view: "artist" | "album"; value: string }>
    ) => {
      if (e.detail.view === "artist") navigateToArtist(e.detail.value);
      else if (e.detail.view === "album") navigateToAlbum(e.detail.value);
    };
    window.addEventListener("navigate", handleNavigate);
    return () => window.removeEventListener("navigate", handleNavigate);
  }, [navigateToArtist, navigateToAlbum]);

  // Clear sorting when entering playlist view
  React.useEffect(() => {
    if (playerState.currentPlaylist) {
      setSortBy(null);
      setSortOrder("asc");
    }
  }, [playerState.currentPlaylist]);

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

  const filteredSongs = songsToDisplay.filter(
    (song: Song) =>
      song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(songSearchQuery.toLowerCase())
  );

  const sortedSongs = React.useMemo(() => {
    let sorted = [...filteredSongs];
    if (sortBy) {
      sorted.sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (sortBy) {
          case "name":
            aVal = a.title.toLowerCase();
            bVal = b.title.toLowerCase();
            break;
          case "artist":
            aVal = a.artist.toLowerCase();
            bVal = b.artist.toLowerCase();
            break;
          case "album":
            aVal = a.album?.toLowerCase() || "";
            bVal = b.album?.toLowerCase() || "";
            break;
          case "rating":
            aVal = ratings[a.id] === "thumbs-up" ? 1 : ratings[a.id] === "thumbs-down" ? -1 : 0;
            bVal = ratings[b.id] === "thumbs-up" ? 1 : ratings[b.id] === "thumbs-down" ? -1 : 0;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredSongs, sortBy, sortOrder, ratings]);

  const handleSongSearch = (query: string) => setSongSearchQuery(query);

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
    const song = library.songs.find((s) => s.id === songId);
    if (song) {
      toast.success(
        wasAdded
          ? t("favorites.added", { title: song.title })
          : t("favorites.removed", { title: song.title })
      );
    }
  };

  const handleDeleteSong = () => {
    if (filteredSongs.length === 0) {
      toast.error(t("delete.noSongs"));
      return;
    }
    setSongToDelete(filteredSongs[0]);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (songToDelete) {
      removeSong(songToDelete.id);
      toast.success(t("deletedFromLibrary", { song: songToDelete.title }));
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
      toast.info(t("filePicker.selectFiles"));
      const audioFiles = await pickAudioFiles();
      if (audioFiles.length === 0) return;

      const BATCH_SIZE = 7;
      let successCount = 0;
      let errorCount = 0;
      let currentBatch = 1;
      const totalBatches = Math.ceil(audioFiles.length / BATCH_SIZE);

      for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
        const batch = audioFiles.slice(i, i + BATCH_SIZE);
        toast.loading(t("batch.processing", { currentBatch, totalBatches }));

        const batchPromises = batch.map(async (audioFile) => {
          try {
            const metadata = await extractAudioMetadata(audioFile.file);
            const audioUrl = createAudioUrl(audioFile.file);
            const song: Song = {
              id: generateUniqueId(),
              title: metadata.title,
              artist: metadata.artist,
              album: metadata.album || t("songInfo.album", { title: t("common.unknownAlbum") }),
              duration: metadata.duration,
              url: audioUrl,
              albumArt: metadata.albumArt,
            };
            await addSong(song);
            successCount++;
          } catch {
            errorCount++;
          }
        });
        await Promise.all(batchPromises);
        currentBatch++;
      }

      toast.dismiss();
      if (successCount > 0) toast.success(t("filePicker.successImport", { count: successCount }));
      if (errorCount > 0) toast.error(t("filePicker.failedImport", { count: errorCount }));
    } catch {
      toast.dismiss();
      toast.error(t("filePicker.failedOpen"));
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectSongsToggle = () => {
    setIsSelectSongsActive((prev) => !prev);
    setSelectedSongs([]);
  };

  const handleSelectAll = () => {
    if (selectedSongs.length === sortedSongs.length) setSelectedSongs([]);
    else setSelectedSongs(sortedSongs.map((song) => song.id));
  };

  const getAllPlaylists = (items: (Playlist | PlaylistFolder)[]): Playlist[] => {
    const result: Playlist[] = [];
    for (const item of items) {
      if ('children' in item) {
        // This is a PlaylistFolder, recurse into children
        result.push(...getAllPlaylists(item.children));
      } else if ('songs' in item) {
        // This is a Playlist
        result.push(item);
      }
      // Skip items that are neither playlists nor folders
    }
    return result;
  };

  const handleAddToPlaylist = () => setShowPlaylistDialog(true);

  const handleCreateNewPlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast.error(t("playlist.enterName"));
      return;
    }
    const newPlaylist = createPlaylist(
      newPlaylistName,
      selectedSongs
        .map((songId) => library.songs.find((s) => s.id === songId))
        .filter((song): song is Song => song !== undefined)
    );
    toast.success(
      t("playlist.created", { name: newPlaylist.name, count: selectedSongs.length })
    );
    setNewPlaylistName("");
    setIsCreatingNew(false);
    setShowPlaylistDialog(false);
  };

  const handleAddToExistingPlaylist = (playlistId: string) => {
    selectedSongs.forEach((songId) => addToPlaylist(playlistId, songId));
    toast.success(
      t("playlist.addedToExisting", { count: selectedSongs.length })
    );
    setShowPlaylistDialog(false);
  };

  const handleDeleteSelectedSongs = () => {
    selectedSongs.forEach((songId) => removeSong(songId));
    toast.success(t("deletedFromLibrary", { song: selectedSongs.length }));
    setSelectedSongs([]);
  };

  return (
    <div className={styles.mainContentWrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          {playerState.view === "songs" ? (
            <h1 className={styles.title}>HTMLPlayer</h1>
          ) : playerState.view === "artist" ? (
            <>
              <Button variant="link" onClick={navigateToSongs} className={styles.backLink}>
                {t("actions.back")}
              </Button>
              <h1 className={styles.title}>{`${t("common.artist")}: ${playerState.currentArtist}`}</h1>
            </>
          ) : playerState.view === "album" ? (
            <>
              <Button variant="link" onClick={navigateToSongs} className={styles.backLink}>
                {t("actions.back")}
              </Button>
              <h1 className={styles.title}>{`${t("common.album")}: ${playerState.currentAlbum}`}</h1>
            </>
          ) : null}
        </div>
        <div className={styles.actions}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} size={16} />
            <Input
              placeholder={t("search.placeholder")}
              className={styles.searchInput}
              value={songSearchQuery}
              onChange={(e: any) => handleSongSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon-md" className={styles.actionButton} onClick={handleDeleteSong}>
            <Trash2 size={16} />
          </Button>
          <PersistentDropdownMenu
            ref={sortDropdownRef}
            trigger={
              <Button variant="outline" size="icon-md" className={styles.actionButton}>
                <ArrowUpDown size={16} />
              </Button>
            }
            onClose={() => {}}
          >
            <Button variant="ghost" onClick={() => setSortBy('name')} className="w-full justify-start text-sm">
              <Type size={16} className="mr-2" />
              {t("sort.name")}
              {sortBy === 'name' && <span className="ml-auto">•</span>}
            </Button>
            <Button variant="ghost" onClick={() => setSortBy('artist')} className="w-full justify-start text-sm">
              <User size={16} className="mr-2" />
              {t("sort.artist")}
              {sortBy === 'artist' && <span className="ml-auto">•</span>}
            </Button>
            <Button variant="ghost" onClick={() => setSortBy('album')} className="w-full justify-start text-sm">
              <Disc size={16} className="mr-2" />
              {t("sort.album")}
              {sortBy === 'album' && <span className="ml-auto">•</span>}
            </Button>
            <Button variant="ghost" onClick={() => setSortBy('rating')} className="w-full justify-start text-sm">
              <Star size={16} className="mr-2" />
              {t("sort.rating")}
              {sortBy === 'rating' && <span className="ml-auto">•</span>}
            </Button>
            <div className="border-t my-1"></div>
            <Button variant="ghost" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="w-full justify-start text-sm">
              <ArrowUp size={16} className={sortOrder === 'asc' ? 'visible mr-2' : 'invisible mr-2'} />
              <ArrowDown size={16} className={sortOrder === 'desc' ? 'visible mr-2' : 'invisible mr-2'} />
              {sortOrder === 'asc' ? t('sort.ascending') : t('sort.descending')}
            </Button>
            <div className="border-t my-1"></div>
            <Button variant="ghost" onClick={() => { setSortBy(null); sortDropdownRef.current?.close(); }} className="w-full justify-start text-sm">
              <X size={16} className="mr-2" />
              {t('sort.clear')}
            </Button>
          </PersistentDropdownMenu>
          <PersistentDropdownMenu
            trigger={
              <Button variant="outline" size="icon-md" className={styles.actionButton} onClick={handleSelectSongsToggle}>
                <ListChecks size={16} />
              </Button>
            }
            onClose={() => handleSelectSongsToggle()}
          >
            <Button variant="ghost" onClick={handleSelectAll}>
              <ListChecks size={16} style={{ marginRight: 8 }} />
              {selectedSongs.length === sortedSongs.length ? t("actions.deselectAll") : t("actions.selectAll")}
            </Button>
            <Button variant="ghost" onClick={handleAddToPlaylist}>
              <Plus size={16} style={{ marginRight: 8 }} />
              {t("playlist.addTo")}
            </Button>
            <Button variant="ghost" onClick={handleDeleteSelectedSongs}>
              <Trash2 size={16} style={{ marginRight: 8 }} />
              {t("common.delete")}
            </Button>
          </PersistentDropdownMenu>
          <Button variant="outline" size="icon-md" className={styles.actionButton} onClick={handleAddMusic}>
            <Plus size={16} />
          </Button>
        </div>
      </div>

      {/* Song list */}
      <div className={styles.songListWrapper}>
        <SortableContext items={sortedSongs.map(song => `song-${song.id}`)} strategy={verticalListSortingStrategy}>
          <div className={styles.songList}>
            <div className={styles.songListHeader}>
              <span className={styles.columnHeader}>{t("songInfo.title")}</span>
              <span className={styles.columnHeader}>{t("common.album")}</span>
              <span className={styles.columnHeader}>{t("actions.addTo")}</span>
            </div>
              {sortedSongs.map((song: Song) => (
                <SortableSongItem
                  key={song.id}
                  song={song}
                  isCurrent={playerState.currentSong?.id === song.id}
                  isSelected={selectedSongs.includes(song.id)}
                  onClick={() => handleSongClick(song)}
                  onCheckboxChange={(e) => {
                    e.stopPropagation();
                    setSelectedSongs(prev =>
                      prev.includes(song.id) ? prev.filter(id => id !== song.id) : [...prev, song.id]
                    );
                  }}
                  isSelectActive={isSelectSongsActive}
                  ratings={ratings}
                  onRatingChange={(rating) => handleRating(song.id, rating)}
                  onFavoriteToggle={(e) => handleToggleFavorite(e, song.id)}
                  isFavorited={isFavorited(song.id)}
                  formatDuration={formatDuration}
                  styles={styles}
                  SongActionsDropdown={SongActionsDropdown}
                  library={library}
                  createPlaylist={createPlaylist}
                  addToPlaylist={addToPlaylist}
                  playSong={playSong}
                  removeSong={removeSong}
                />
              ))}
              {sortedSongs.length === 0 && (
                <div className={styles.noResults}>
                  {songSearchQuery ? t("noResults.search") : t("noResults.playlist")}
                </div>
              )}
            </div>
          </SortableContext>
      </div>

      {/* Delete Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete.songTitle")}</DialogTitle>
            <DialogDescription>{t("delete.confirm", { title: songToDelete?.title })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Song Info Modal */}
      <Dialog open={showSongInfo} onOpenChange={setShowSongInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("songInfo.songInfoTitle")}</DialogTitle>
          </DialogHeader>
          {selectedSongInfo && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
              <div><strong>{t("songInfo.title")}:</strong> {selectedSongInfo.title}</div>
              <div><strong>{t("common.artist")}:</strong> {selectedSongInfo.artist}</div>
              <div><strong>{t("common.album")}:</strong> {selectedSongInfo.album}</div>
              <div><strong>{t("common.duration")}:</strong> {formatDuration(selectedSongInfo.duration)}</div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowSongInfo(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Playlist Dialog */}
      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("playlist.addTo")}</DialogTitle>
            <DialogDescription>
              {selectedSongs.length === 1
                ? t("choosePlaylistOrCreate", { song: library.songs.find(s => s.id === selectedSongs[0])?.title || "Unknown" })
                : t("choosePlaylistOrCreateMultiple", { count: selectedSongs.length })}
            </DialogDescription>
          </DialogHeader>

          {isCreatingNew ? (
            <div className={modalStyles.spaceY4}>
              <Input
                placeholder={t("playlist.enterName")}
                value={newPlaylistName}
                onChange={(e: any) => setNewPlaylistName(e.target.value)}
              />
              <div className={`${modalStyles.flex} ${modalStyles.gap2}`}>
                <Button variant="outline" onClick={() => setIsCreatingNew(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreateNewPlaylist}>
                  {t("create")}
                </Button>
              </div>
            </div>
          ) : (
            <div className={modalStyles.spaceY4}>
              {getAllPlaylists(library.playlists).filter((p) => p.id !== "all-songs").length > 0 ? (
                <div className={modalStyles.spaceY2}>
                  {getAllPlaylists(library.playlists)
                    .filter((playlist) => playlist.id !== "all-songs")
                    .map((playlist) => (
                      <div
                        key={playlist.id}
                        className={`${modalStyles.flex} ${modalStyles.gap2}`}
                      >
                        <Button
                          variant="outline"
                          className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
                          onClick={() => handleAddToExistingPlaylist(playlist.id)}
                        >
                          <Music size={16} className="mr-2" />
                          {playlist.name}
                        </Button>
                      </div>
                    ))}
                </div>
              ) : (
                <p className={modalStyles.muted}>{t("playlist.noPlaylists")}</p>
              )}

              <Button
                variant="outline"
                className={modalStyles["w-full"]}
                onClick={() => setIsCreatingNew(true)}
              >
                <PlusCircle size={16} className="mr-2" />
                {t("playlist.createNewPlaylist")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
