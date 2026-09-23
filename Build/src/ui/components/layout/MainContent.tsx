import React, { useState, useCallback } from "react";
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
import { importAudioFiles } from "../../../helpers/importAudioFiles";
import { prepareAndStoreSong } from "../../../helpers/addSong";
import { Home } from "../features/Home";
import { useAlbumArt } from "../../../hooks/useAlbumArt";
import { useNavigation } from "../../navigation";
import { MainContentHeader } from "./MainContentHeader";
import type { Track, Playlist } from "../../../core/engine/types";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";
import type { PersistentDropdownMenuRef } from "../primitives/PersistentDropdownMenu";
import {
  selectCurrentPlaylist,
  selectCurrentTrack,
  useKomorebiStore,
} from "../../../store";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface SortableSongItemProps {
  song: Track;
  isCurrent: boolean;
  isSelected: boolean;
  onClick: (song: Track) => void;
  onSelectionChange: (songId: string, checked: boolean) => void;
  isSelectActive: boolean;
  ratings: Record<string, "thumbs-up" | "thumbs-down" | "none">;
  onRateSong: (songId: string, rating: "thumbs-up" | "thumbs-down") => void;
  onToggleFavorite: (songId: string) => void;
  isFavorited: boolean;
  library: MusicLibrary;
  createPlaylist: (name: string) => Playlist;
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
  onSelectionChange,
  isSelectActive,
  ratings,
  onRateSong,
  onToggleFavorite,
  isFavorited,
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
      onClick={() => onClick(song)}
      ref={containerRef}
    >
      <div className={styles.songInfo}>
        {dragHandleProps && (
          <DragHandle {...dragHandleProps} className={styles.dragHandle}>
            <Icon name="gripVertical" size={16} decorative />
          </DragHandle>
        )}
        {isSelectActive && (
          <Checkbox
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelectionChange(song.id, e.target.checked);
            }}
          />
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
            onToggleFavorite(song.id);
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
            onRateSong(song.id, "thumbs-up");
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
            onRateSong(song.id, "thumbs-down");
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
  const { songs, library } = komorebi;

  const currentTrack = useKomorebiStore(selectCurrentTrack);
  const engineCurrentPlaylist = useKomorebiStore(selectCurrentPlaylist);

  const currentPlaylist = engineCurrentPlaylist
    ? library.getPlaylist(engineCurrentPlaylist.id) ?? engineCurrentPlaylist
    : null;

  const libraryState: MusicLibrary = React.useMemo(
    () => ({
      songs,
      playlists: library.getState().playlists,
      favorites: library.getState().favorites,
    }),
    [songs, library],
  );

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
  } = komorebi;

  const createPlaylist = useCallback(
    (name: string) => {
      const playlist: Playlist = {
        id: `playlist-${Date.now()}`,
        name,
        songs: [],
      };
      library.addPlaylist(playlist);
      return playlist;
    },
    [library],
  );

  const addToPlaylist = useCallback(
    (playlistId: string, songId: string) => {
      const song = library.getSong(songId);
      if (song) {
        library.addToPlaylist(playlistId, song);
      }
    },
    [library],
  );

  // Clear sorting when entering playlist view
  React.useEffect(() => {
    if (currentPlaylist) {
      setSortBy(null);
      setSortOrder("asc");
    }
  }, [currentPlaylist?.id]);

  const songsToDisplay = React.useMemo(() => {
    if (navState.view === "artist" && navState.artist) {
      return songs.filter(
        (song: Track) => song.artist === navState.artist,
      );
    } else if (navState.view === "album" && navState.album) {
      return songs.filter(
        (song: Track) => song.album === navState.album,
      );
    } else if (currentPlaylist) {
      return currentPlaylist.songs;
    } else {
      return songs;
    }
  }, [
    navState.view,
    navState.artist,
    navState.album,
    currentPlaylist,
    songs,
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

  const handleSongClick = useCallback(
    (song: Track) => {
      playSong(song, currentPlaylist || undefined);
    },
    [playSong, currentPlaylist],
  );

  const handleRating = useCallback(
    (
      songId: string,
      rating: "thumbs-up" | "thumbs-down",
    ) => {
      setRatings((prev) => {
        const currentRating = prev[songId];
        return { ...prev, [songId]: currentRating === rating ? "none" : rating };
      });
    },
    [],
  );

  const handleSelectionChange = useCallback(
    (songId: string, checked: boolean) => {
      setSelectedSongs((prev) =>
        checked
          ? prev.includes(songId)
            ? prev
            : [...prev, songId]
          : prev.filter((id) => id !== songId),
      );
    },
    [],
  );

  const handleToggleFavorite = useCallback(
    (songId: string) => {
      const wasFavorite = library.isFavorite(songId);
      toggleFavorite(songId);
      const song = songs.find((s) => s.id === songId);
      if (song) {
        toast.success(
          wasFavorite
            ? t("favorites.removed", { title: song.title })
            : t("favorites.added", { title: song.title }),
        );
      }
    },
    [toggleFavorite, library, songs, t],
  );

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
      if (!songToDelete) return;
      removeSong(songToDelete.id);
      toast.success(t("deletedFromLibrary", { song: songToDelete.title }));
      return;
    }

    // Show confirmation dialog
    const firstSong = filteredSongs[0];
    if (firstSong) {
      setSongToDelete(firstSong);
      setShowDeleteConfirm(true);
    }
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
    const wrappedAddSong = async (song: Track, file: File) => {
      await prepareAndStoreSong(song, file);
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
      <Button
        variant="ghost"
        size="sm"
        className={`${styles.viewSwitchButton} ${navState.view === "home" ? styles.viewSwitchButtonActive : ""}`}
        onClick={goHome}
        aria-pressed={navState.view === "home"}
      >
        <Icon name="home" size={14} decorative />
        {t("home.title")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`${styles.viewSwitchButton} ${isLibraryContext ? styles.viewSwitchButtonActive : ""}`}
        onClick={goToSongs}
        aria-pressed={isLibraryContext}
      >
        <Icon name="list" size={14} decorative />
        {t("allSongs")}
      </Button>
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
                isCurrent={currentTrack?.id === song.id}
                isSelected={selectedSongs.includes(song.id)}
                onClick={handleSongClick}
                onSelectionChange={handleSelectionChange}
                isSelectActive={isSelectSongsActive}
                ratings={ratings}
                onRateSong={handleRating}
                onToggleFavorite={handleToggleFavorite}
                isFavorited={library.isFavorite(song.id)}
                library={libraryState}
                createPlaylist={createPlaylist}
                addToPlaylist={addToPlaylist}
                playSong={playSong}
                isInPlaylist={!!currentPlaylist}
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
          .map((id) => songs.find((s) => s.id === id))
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
