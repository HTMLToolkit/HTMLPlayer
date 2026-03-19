import React, { useState } from "react";
import {
  DraggableItem,
  DropZone,
  DragHandle,
  DragHandleProps,
} from "../primitives/Draggable";
import { SongActionsDropdown } from "../shared/SongActionsDropdown";
import { Checkbox } from "../primitives/Checkbox";
import { useRightClickMenu } from "../primitives/DropdownMenu";
import { pickAudioFiles } from "../../../helpers/filePickerHelper";
import { toast } from "sonner";
import { Button } from "../primitives/Button";
import { Input } from "../primitives/Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../primitives/Dialog";
import styles from "./MainContent.module.css";
import PersistentDropdownMenu, {
  PersistentDropdownMenuRef,
} from "../primitives/PersistentDropdownMenu";
import { AddToPopover } from "../shared/AddToPopover";
import { useTranslation } from "react-i18next";
import { Icon } from "../shared/Icon";
import { musicIndexedDbHelper } from "../../../helpers/musicIndexedDbHelper";
import { importAudioFiles } from "../../../helpers/importAudioFiles";
import { Home } from "../features/Home";
import { useAlbumArt } from "../../../hooks/useAlbumArt";
import { useNavigation } from "../../navigation";
import type { Track, Playlist } from "../../../core/engine/types";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";

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
  isInPlaylist: boolean; // New prop to determine drag behavior
}
const SortableSongItem = React.memo(function SortableSongItem({
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
  isInPlaylist,
}: SortableSongItemProps) {
  const { t } = useTranslation();
  const { open, setOpen, containerRef } = useRightClickMenu(true);

  // Lazy load album art - only loads when component is rendered
  // Use song.albumArt if already loaded (for newly imported songs), otherwise lazy load
  const lazyAlbumArt = useAlbumArt(
    song.id,
    song.hasAlbumArt || !!song.albumArt,
  );
  const albumArt = song.albumArt || lazyAlbumArt;

  // Use DraggableItem for clean drag functionality, and DropZone if in playlist for reordering
  const songContent = (dragHandleProps?: DragHandleProps) => (
    <div
      className={`${styles.songItem} ${isCurrent ? styles.currentSong : ""}`}
      onClick={onClick}
      ref={containerRef}
    >
      <div className={styles.songInfo}>
        {dragHandleProps && (
          <DragHandle {...dragHandleProps} className={styles.dragHandle}>
            <Icon name="gripVertical" size={16} decorative />
          </DragHandle>
        )}
        {isSelectActive && (
          <Checkbox checked={isSelected} onChange={onCheckboxChange} />
        )}
        <div className={styles.albumArt}>
          {albumArt && (
            <img
              src={albumArt}
              alt={t("player.albumArtAlt", { title: song.title })}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "inherit",
              }}
            />
          )}
        </div>
        <div className={styles.songDetails}>
          <div className={styles.songTitle}>{song.title}</div>
          <div className={styles.songArtist}>
            <span className={`${styles.fieldLabel}`}>
              {t("common.album")}:{" "}
            </span>
            {song.album || t("common.unknownAlbum")}
            <span className={`${styles.fieldLabel} ${styles.desktopOnly}`}>
              {" "}
              {t("common.duration")}: {formatDuration(song.duration)}
            </span>
          </div>
          <div className={`${styles.albumName} ${styles.mobileOnly}`}>
            <span className={styles.fieldLabel}>{t("common.artist")}: </span>
            {song.artist}
          </div>
        </div>
      </div>
      <div className={`${styles.albumName} ${styles.desktopOnly}`}>
        {song.artist}
      </div>
      <div className={styles.songActions}>
        <Button
          variant="ghost"
          size="icon-sm"
          className={`${styles.songActionButton} ${isFavorited ? styles.favorited : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle(e);
          }}
        >
          <Icon
            name="heart"
            size={14}
            fill={isFavorited ? "currentColor" : "none"}
            decorative
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={`${styles.songActionButton} ${ratings[song.id] === "thumbs-up" ? styles.active : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onRatingChange("thumbs-up");
          }}
        >
          <Icon name="thumbsUp" size={14} decorative />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={`${styles.songActionButton} ${ratings[song.id] === "thumbs-down" ? styles.active : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onRatingChange("thumbs-down");
          }}
        >
          <Icon name="thumbsDown" size={14} decorative />
        </Button>
        <SongActionsDropdown
          song={song}
          library={library}
          onCreatePlaylist={createPlaylist}
          onAddToPlaylist={addToPlaylist}
          onRemoveSong={removeSong}
          onPlaySong={playSong}
          size={14}
          className={styles.songActionButton}
          open={open}
          onOpenChange={setOpen}
        />
      </div>
    </div>
  );

  return (
    <DraggableItem id={song.id} type="song" data={song} useDragHandle>
      {(dragHandleProps) =>
        isInPlaylist ? (
          <DropZone
            id={song.id}
            type="song"
            data={song}
            className={styles.songDropZone}
          >
            {songContent(dragHandleProps)}
          </DropZone>
        ) : (
          songContent(dragHandleProps)
        )
      }
    </DraggableItem>
  );
});

interface MainContentProps {
  komorebi: UseKomorebiReturn;
  onMobileMenuClick?: () => void;
}

export const MainContent = ({
  komorebi,
  onMobileMenuClick,
}: MainContentProps) => {
  const { t } = useTranslation();
  const { state: navState, goToSongs, goHome } = useNavigation();
  const library = komorebi.library;
  const libraryState = library.getState();

  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "artist" | "album" | "rating" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [ratings, setRatings] = useState<Record<string, "thumbs-up" | "thumbs-down" | "none">>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);

  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [isSelectSongsActive, setIsSelectSongsActive] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const sortDropdownRef = React.useRef<PersistentDropdownMenuRef>(null);

  const { playSong, addSong, removeSong, toggleFavorite, state: engineState } = komorebi;

  const createPlaylist = (name: string) => {
    const playlist: Playlist = { id: `playlist-${Date.now()}`, name, songs: [] };
    library.addPlaylist(playlist);
    return playlist;
  };

  const addToPlaylist = (playlistId: string, songId: string) => {
    const playlist = library.getPlaylist(playlistId);
    const song = library.getSong(songId);
    if (playlist && song) {
      playlist.songs.push(song);
      library.updatePlaylist(playlistId, { songs: playlist.songs });
    }
  };

  // Clear sorting when entering playlist view
  React.useEffect(() => {
    if (engineState.currentPlaylist) {
      setSortBy(null);
      setSortOrder("asc");
    }
  }, [engineState.currentPlaylist]);

  const songsToDisplay = React.useMemo(() => {
    if (navState.view === "artist" && navState.artist) {
      return libraryState.songs.filter(
        (song: Track) => song.artist === navState.artist,
      );
    } else if (navState.view === "album" && navState.album) {
      return libraryState.songs.filter(
        (song: Track) => song.album === navState.album,
      );
    } else if (engineState.currentPlaylist) {
      return engineState.currentPlaylist.songs;
    } else {
      return libraryState.songs;
    }
  }, [
    navState.view,
    navState.artist,
    navState.album,
    engineState.currentPlaylist,
    libraryState.songs,
  ]);

  const filteredSongs = React.useMemo(() => {
    const query = songSearchQuery.toLowerCase();
    if (!query) return songsToDisplay;
    return songsToDisplay.filter(
      (song: Song) =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query),
    );
  }, [songsToDisplay, songSearchQuery]);

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
            aVal =
              ratings[a.id] === "thumbs-up"
                ? 1
                : ratings[a.id] === "thumbs-down"
                  ? -1
                  : 0;
            bVal =
              ratings[b.id] === "thumbs-up"
                ? 1
                : ratings[b.id] === "thumbs-down"
                  ? -1
                  : 0;
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
    playSong(song, engineState.currentPlaylist || undefined);
  };

  const handleRating = (
    songId: string,
    rating: "thumbs-up" | "thumbs-down",
  ) => {
    const currentRating = ratings[songId];
    const newRating = currentRating === rating ? "none" : rating;
    setRatings((prev) => ({ ...prev, [songId]: newRating }));
  };

  const handleToggleFavorite = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    songId: string,
  ) => {
    e.stopPropagation();
    const wasFavorite = library.isFavorite(songId);
    toggleFavorite(songId);
    const song = libraryState.songs.find((s) => s.id === songId);
    if (song) {
      toast.success(
        wasFavorite
          ? t("favorites.removed", { title: song.title })
          : t("favorites.added", { title: song.title }),
      );
    }
  };

  const handleDeleteSong = async () => {
    if (filteredSongs.length === 0) {
      toast.error(t("delete.noSongs"));
      return;
    }

    // Check if user has chosen not to show delete confirmation
    const shouldShow = await musicIndexedDbHelper.shouldShowDialog(
      "delete-song-confirmation",
    );
    if (!shouldShow) {
      // Delete directly without showing dialog
      const songToDelete = filteredSongs[0];
      removeSong(songToDelete.id);
      toast.success(t("deletedFromLibrary", { song: songToDelete.title }));
      return;
    }

    // Show confirmation dialog
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

  // Helper to import audio files (used for both manual and share target)
  const handleImportAudioFiles = async (
    audioFiles: Array<{ file: File } | File>,
  ) => {
    const wrappedAddSong = async (song: any) => {
      addSong(song);
    };
    await importAudioFiles(audioFiles, wrappedAddSong, t);
  };

  // Manual add music (Uppy)
  const handleAddMusic = async () => {
    try {
      toast.info(t("filePicker.selectFiles"));
      const audioFiles = await pickAudioFiles();
      await handleImportAudioFiles(audioFiles);
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

  const handleAddToPlaylist = () => setShowPlaylistDialog(true);

  const handleDeleteSelectedSongs = () => {
    selectedSongs.forEach((songId) => removeSong(songId));
    toast.success(t("deletedFromLibrary", { song: selectedSongs.length }));
    setSelectedSongs([]);
  };

  const isHomeView = navState.view === "home";
  const isLibraryContext = navState.view !== "home";

  const viewSwitcher = (
    <div
      className={styles.viewSwitcher}
      role="group"
      aria-label={t("home.title")}
    >
      <button
        type="button"
        className={`${styles.viewSwitchButton} ${navState.view === "home" ? styles.viewSwitchButtonActive : ""}`}
        onClick={goHome}
        aria-pressed={navState.view === "home"}
      >
        <Icon name="home" size={14} decorative />
        {t("home.title")}
      </button>
      <button
        type="button"
        className={`${styles.viewSwitchButton} ${isLibraryContext ? styles.viewSwitchButtonActive : ""}`}
        onClick={goToSongs}
        aria-pressed={isLibraryContext}
      >
        <Icon name="list" size={14} decorative />
        {t("allSongs")}
      </button>
    </div>
  );

  return (
    <div className={styles.mainContentWrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.mobileMenuButton}
            onClick={onMobileMenuClick}
            aria-label={t("menu")}
          >
            <Icon name="menu" size={24} decorative />
          </Button>
          {navState.view === "home" ? (
            <h1 className={styles.title}>HTMLPlayer</h1>
          ) : navState.view === "songs" ? (
            <h1 className={styles.title}>HTMLPlayer</h1>
          ) : navState.view === "artist" ? (
            <>
              <Button
                variant="link"
                onClick={goToSongs}
                className={styles.backLink}
              >
                {t("actions.back")}
              </Button>
              <h1
                className={styles.title}
              >{`${t("common.artist")}: ${navState.artist}`}</h1>
            </>
          ) : navState.view === "album" ? (
            <>
              <Button
                variant="link"
                onClick={goToSongs}
                className={styles.backLink}
              >
                {t("actions.back")}
              </Button>
              <h1
                className={styles.title}
              >{`${t("common.album")}: ${navState.album}`}</h1>
            </>
          ) : null}
          <div className={styles.mobileOnly} style={{ marginLeft: "auto" }}>
            {viewSwitcher}
          </div>
        </div>
        {isHomeView && (
          <div className={`${styles.desktopOnly} ${styles.viewSwitcherRow}`}>
            {viewSwitcher}
          </div>
        )}
        {!isHomeView && (
          <div className={styles.actions}>
            <div className={styles.searchWrapper}>
              <Icon
                name="search"
                className={styles.searchIcon}
                size={16}
                decorative
              />
              <Input
                placeholder={t("search.placeholder")}
                className={styles.searchInput}
                value={songSearchQuery}
                onChange={(e: any) => handleSongSearch(e.target.value)}
                data-tour="search"
              />
            </div>
            <div className={styles.buttonGroup}>
              <Button
                variant="outline"
                size="icon-md"
                className={styles.actionButton}
                onClick={handleDeleteSong}
                aria-label={t("actions.delete")}
              >
                <Icon name="trash2" size={16} decorative />
              </Button>
              <PersistentDropdownMenu
                ref={sortDropdownRef}
                trigger={
                  <Button
                    variant="outline"
                    size="icon-md"
                    className={styles.actionButton}
                    aria-label={t("sort.sortBy")}
                  >
                    <Icon name="arrowUpDown" size={16} decorative />
                  </Button>
                }
                onClose={() => {}}
              >
                <Button
                  variant="ghost"
                  onClick={() => setSortBy("name")}
                  className="w-full justify-start text-sm"
                >
                  <Icon name="type" size={16} className="mr-2" decorative />
                  {t("sort.name")}
                  {sortBy === "name" && <span className="ml-auto">•</span>}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSortBy("artist")}
                  className="w-full justify-start text-sm"
                >
                  <Icon name="user" size={16} className="mr-2" decorative />
                  {t("sort.artist")}
                  {sortBy === "artist" && <span className="ml-auto">•</span>}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSortBy("album")}
                  className="w-full justify-start text-sm"
                >
                  <Icon name="disc" size={16} className="mr-2" decorative />
                  {t("sort.album")}
                  {sortBy === "album" && <span className="ml-auto">•</span>}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSortBy("rating")}
                  className="w-full justify-start text-sm"
                >
                  <Icon name="star" size={16} className="mr-2" decorative />
                  {t("sort.rating")}
                  {sortBy === "rating" && <span className="ml-auto">•</span>}
                </Button>
                <div className="border-t my-1"></div>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="w-full justify-start text-sm"
                >
                  {sortOrder === "asc" ? (
                    <Icon
                      name="arrowUp"
                      size={16}
                      className="mr-2"
                      decorative
                    />
                  ) : (
                    <Icon
                      name="arrowDown"
                      size={16}
                      className="mr-2"
                      decorative
                    />
                  )}
                  {sortOrder === "asc"
                    ? t("sort.ascending")
                    : t("sort.descending")}
                </Button>
                <div className="border-t my-1"></div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSortBy(null);
                    sortDropdownRef.current?.close();
                  }}
                  className="w-full justify-start text-sm"
                >
                  <Icon name="close" size={16} className="mr-2" decorative />
                  {t("sort.clear")}
                </Button>
              </PersistentDropdownMenu>
              <PersistentDropdownMenu
                trigger={
                  <Button
                    variant="outline"
                    size="icon-md"
                    className={styles.actionButton}
                    onClick={handleSelectSongsToggle}
                    aria-label={t("actions.selectSongs")}
                  >
                    <Icon name="listChecks" size={16} decorative />
                  </Button>
                }
                onClose={() => handleSelectSongsToggle()}
              >
                <Button variant="ghost" onClick={handleSelectAll}>
                  <Icon
                    name="listChecks"
                    size={16}
                    style={{ marginRight: 8 }}
                    decorative
                  />
                  {selectedSongs.length === sortedSongs.length
                    ? t("actions.deselectAll")
                    : t("actions.selectAll")}
                </Button>
                <Button variant="ghost" onClick={handleAddToPlaylist}>
                  <Icon
                    name="plus"
                    size={16}
                    style={{ marginRight: 8 }}
                    decorative
                  />
                  {t("playlist.addTo")}
                </Button>
                <Button variant="ghost" onClick={handleDeleteSelectedSongs}>
                  <Icon
                    name="trash2"
                    size={16}
                    style={{ marginRight: 8 }}
                    decorative
                  />
                  {t("common.delete")}
                </Button>
              </PersistentDropdownMenu>
              <Button
                variant="outline"
                size="icon-md"
                className={styles.actionButton}
                onClick={handleAddMusic}
                aria-label={t("actions.addMusic")}
                data-tour="upload-music"
              >
                <Icon name="plus" size={16} decorative />
              </Button>
              <div className={styles.desktopOnly}>{viewSwitcher}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      {isHomeView ? (
        <div className={styles.homeContent}>
          <Home komorebi={komorebi} onAddMusic={handleAddMusic} />
        </div>
      ) : (
        <div className={styles.songListWrapper}>
          <div className={styles.songList}>
            <div className={styles.songListHeader}>
              <span className={styles.columnHeader}>{t("songInfo.title")}</span>
              <span className={`${styles.columnHeader} ${styles.desktopOnly}`}>
                {t("common.artist")}
              </span>
              <span className={styles.columnHeader}>{t("actions.addTo")}</span>
            </div>
            {sortedSongs.map((song: Song) => (
              <SortableSongItem
                key={song.id}
                song={song}
                isCurrent={engineState.currentTrack?.id === song.id}
                isSelected={selectedSongs.includes(song.id)}
                onClick={() => handleSongClick(song)}
                onCheckboxChange={(e) => {
                  e.stopPropagation();
                  setSelectedSongs((prev) =>
                    prev.includes(song.id)
                      ? prev.filter((id) => id !== song.id)
                      : [...prev, song.id],
                  );
                }}
                isSelectActive={isSelectSongsActive}
                ratings={ratings}
                onRatingChange={(rating) => handleRating(song.id, rating)}
                onFavoriteToggle={(e) => handleToggleFavorite(e, song.id)}
                isFavorited={library.isFavorite(song.id)}
                formatDuration={formatDuration}
                styles={styles}
                SongActionsDropdown={SongActionsDropdown}
                library={libraryState}
                createPlaylist={createPlaylist}
                addToPlaylist={addToPlaylist}
                playSong={playSong}
                isInPlaylist={!!engineState.currentPlaylist}
                removeSong={removeSong}
              />
            ))}
            {sortedSongs.length === 0 && (
              <div className={styles.noResults}>
                {songSearchQuery
                  ? t("noResults.search")
                  : t("noResults.playlist")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent dontShowAgainKey="delete-song-confirmation">
          <DialogHeader>
            <DialogTitle>{t("delete.songTitle")}</DialogTitle>
            <DialogDescription>
              {t("delete.confirm", { title: songToDelete?.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add To Popover */}
      <AddToPopover
        songs={selectedSongs
          .map((id) => libraryState.songs.find((s) => s.id === id))
          .filter((s): s is Song => s !== undefined)}
        library={libraryState}
        onCreatePlaylist={createPlaylist}
        onAddToPlaylist={addToPlaylist}
        open={showPlaylistDialog}
        onOpenChange={setShowPlaylistDialog}
      />
    </div>
  );
};
