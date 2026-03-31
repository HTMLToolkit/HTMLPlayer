import React, { useState } from "react";
import {
  DraggableItem,
  DropZone,
  DragHandle,
  DragHandleProps,
} from "../primitives/Draggable";
import { SongActionsDropdown } from "../shared/SongActionsDropdown";
import { Checkbox } from "../primitives/Checkbox";
import { Button } from "../primitives/Button";
import { useRightClickMenu } from "../primitives/DropdownMenu";
import { pickAudioFiles } from "../../../hooks/useFilePicker";
import { toast } from "sonner";
import styles from "./MainContent.module.css";
import { AddToPopover } from "../shared/AddToPopover";
import { useTranslation } from "react-i18next";
import { Icon } from "../shared/Icon";
import { dialogStorage } from "../../../platform/storage";
import { trackStorage } from "../../../platform/storage/trackStorage";
import { importAudioFiles } from "../../../helpers/importAudioFiles";
import { Home } from "../features/Home";
import { useAlbumArt } from "../../../hooks/useAlbumArt";
import { useNavigation } from "../../navigation";
import { MainContentHeader } from "./MainContentHeader";
import type { Track, Playlist } from "../../../core/engine/types";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";
import type { PersistentDropdownMenuRef } from "../primitives/PersistentDropdownMenu";

interface SortableSongItemProps {
  song: Track;
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
  playSong: (song: Track, playlist?: Playlist) => void;
  removeSong: (songId: string) => void;
  isInPlaylist: boolean;
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
  const [sortBy, setSortBy] = useState<
    "name" | "artist" | "album" | "rating" | null
  >(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [ratings, setRatings] = useState<
    Record<string, "thumbs-up" | "thumbs-down" | "none">
  >({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Track | null>(null);

  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [isSelectSongsActive, setIsSelectSongsActive] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const sortDropdownRef = React.useRef<PersistentDropdownMenuRef>(null);

  const {
    playSong,
    addSong,
    removeSong,
    toggleFavorite,
    state: engineState,
  } = komorebi;

  const createPlaylist = (name: string) => {
    const playlist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      songs: [],
    };
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
      (song: Track) =>
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

  const handleSongClick = (song: Track) => {
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
    const shouldShow = await dialogStorage.shouldShow(
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

  // Helper to import audio files (used for both manual and share target)
  const handleImportAudioFiles = async (
    audioFiles: Array<{ file: File } | File>,
  ) => {
    const wrappedAddSong = async (song: any, file: File) => {
      console.log("[import] before setting:", { id: song.id, hasStoredAudio: song.hasStoredAudio, url: song.url });
      song.url = URL.createObjectURL(file);
      song.hasStoredAudio = true;
      console.log("[import] after setting:", { id: song.id, hasStoredAudio: song.hasStoredAudio, url: song.url });
      
      const arrayBuffer = await file.arrayBuffer();
      console.log("[import] arrayBuffer size:", arrayBuffer.byteLength);
      await trackStorage.saveTrack(song, arrayBuffer);
      console.log("[import] saved to trackStorage");
      
      addSong(song);
      console.log("[import] added to library");
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
      <MainContentHeader
        navState={navState}
        songSearchQuery={songSearchQuery}
        onSearchChange={handleSongSearch}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortByChange={setSortBy}
        onSortOrderChange={setSortOrder}
        selectedSongs={selectedSongs}
        sortedSongsCount={sortedSongs.length}
        onToggleSelect={handleSelectSongsToggle}
        onAddToPlaylist={handleAddToPlaylist}
        onDeleteSelected={handleDeleteSelectedSongs}
        onDeleteSong={handleDeleteSong}
        onAddMusic={handleAddMusic}
        onMobileMenuClick={onMobileMenuClick ?? (() => {})}
        onBackClick={goToSongs}
        sortDropdownRef={sortDropdownRef}
        songToDelete={songToDelete}
        showDeleteConfirm={showDeleteConfirm}
        onDeleteConfirm={handleDeleteConfirm}
        onDeleteConfirmOpenChange={setShowDeleteConfirm}
        t={t}
        isHomeView={isHomeView}
        viewSwitcher={viewSwitcher}
      />

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
            {sortedSongs.map((song: Track) => (
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

      {/* Add To Popover */}
      <AddToPopover
        songs={selectedSongs
          .map((id) => libraryState.songs.find((s) => s.id === id))
          .filter((s): s is Track => s !== undefined)}
        library={libraryState}
        onCreatePlaylist={createPlaylist}
        onAddToPlaylist={addToPlaylist}
        open={showPlaylistDialog}
        onOpenChange={setShowPlaylistDialog}
      />
    </div>
  );
};
