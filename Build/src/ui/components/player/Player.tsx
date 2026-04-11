import {
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useTranslation } from "react-i18next";
import { isSafari } from "../../../platform/utils/safari";
import { Visualizer } from "./Visualizer";
import { Lyrics } from "./Lyrics";
import styles from "./Player.module.css";
import { SongActionsDropdown } from "../shared/SongActionsDropdown";
import { useNavigation } from "../../navigation";
import { ProgressBar } from "./ProgressBar";
import { VolumeControl } from "./VolumeControl";
import { PlayerControls } from "./PlayerControls";
import { PlayerAlbumArt } from "./PlayerAlbumArt";
import { PlayerTrackInfo } from "./PlayerTrackInfo";
import { PlayerSecondaryControls } from "./PlayerSecondaryControls";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";

interface PlayerProps {
  komorebi: UseKomorebiReturn;
}

export interface PlayerRef {
  toggleVisualizer: () => void;
  toggleLyrics: () => void;
}

export const Player = forwardRef<PlayerRef, PlayerProps>(
  ({ komorebi }, ref) => {
    const { t } = useTranslation();
    const settings = komorebi.settings;
    const settingsState = settings.getSettings();

    const {
      currentTrack,
      isPlaying,
      currentTime,
      volume,
      shuffle,
      repeat,
      seek,
      next,
      previous,
      setVolume,
      toggleShuffle,
      toggleRepeat,
      togglePlayPause,
      library,
    } = komorebi;

    const { state: navState } = useNavigation();
    const currentSong = currentTrack;
    const libraryState = library.getState();

    const [showVisualizer, setShowVisualizer] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const [isVisualizerClosing, setIsVisualizerClosing] = useState(false);
    const [isLyricsClosing, setIsLyricsClosing] = useState(false);
    const [hasVisualizerAnimatedIn, setHasVisualizerAnimatedIn] = useState(false);

    useEffect(() => {
      if (showVisualizer && !isVisualizerClosing && !hasVisualizerAnimatedIn) {
        const timer = setTimeout(() => setHasVisualizerAnimatedIn(true), 250);
        return () => clearTimeout(timer);
      }
      if (!showVisualizer) {
        setHasVisualizerAnimatedIn(false);
      }
    }, [showVisualizer, isVisualizerClosing, hasVisualizerAnimatedIn]);

    const handleVolumeToggle = useCallback(() => {
      setVolume(volume === 0 ? 0.7 : 0);
    }, [volume, setVolume]);

    const handleFavorite = () => {
      if (!currentSong) return;
      komorebi.toggleFavorite(currentSong.id);
    };

    const handleVisualizerToggle = useCallback(() => {
      if (showVisualizer || isVisualizerClosing) {
        setIsVisualizerClosing(true);
        setTimeout(() => {
          setIsVisualizerClosing(false);
          setShowVisualizer(false);
        }, 250);
      } else {
        setShowVisualizer(true);
      }
    }, [showVisualizer, isVisualizerClosing]);

    const handleLyricsToggle = useCallback(() => {
      if (showLyrics || isLyricsClosing) {
        setIsLyricsClosing(true);
        setTimeout(() => {
          setIsLyricsClosing(false);
          setShowLyrics(false);
        }, 250);
      } else {
        setShowLyrics(true);
      }
    }, [showLyrics, isLyricsClosing]);

    useImperativeHandle(
      ref,
      () => ({
        toggleVisualizer: handleVisualizerToggle,
        toggleLyrics: handleLyricsToggle,
      }),
      [handleVisualizerToggle, handleLyricsToggle],
    );

    useEffect(() => {
      if (currentSong && settingsState.showLyrics) setShowLyrics(true);
    }, [currentSong, settingsState.showLyrics]);

    const isOnSafari = isSafari();
    const isHomeView = navState.view === "home";

    if (!currentSong) {
      return (
        <div
          className={`${styles.player} ${isHomeView ? styles.playerCompact : ""}`}
        >
          <div className={styles.noSong}>
            <span>{t("player.selectSong")}</span>
          </div>
        </div>
      );
    }

    const isFavorite = libraryState.favorites.includes(currentSong.id);
    const visualizerDataState = isVisualizerClosing
      ? "closing"
      : hasVisualizerAnimatedIn
        ? "visible"
        : "open";

    return (
      <>
        {(showVisualizer || isVisualizerClosing) && (
          <div
            className={styles.visualizerOverlay}
            data-tour="visualizer"
            data-state={visualizerDataState}
          >
            <Visualizer isPlaying={isPlaying} className={styles.visualizer} />
          </div>
        )}
        <div
          className={`${styles.player} ${isHomeView ? styles.playerCompact : ""}`}
        >
          <div className={styles.currentSong}>
            <PlayerAlbumArt
              songId={currentSong?.id}
              hasAlbumArt={currentSong?.hasAlbumArt}
              albumArt={currentSong?.albumArt}
              title={currentSong?.title || ""}
            />
            <PlayerTrackInfo
              title={currentSong?.title}
              artist={currentSong?.artist}
            />
          </div>

          <div className={styles.controls} data-tour="player-controls">
            <PlayerControls
              isPlaying={isPlaying}
              shuffle={shuffle}
              repeat={repeat}
              onTogglePlayPause={togglePlayPause}
              onNext={next}
              onPrevious={previous}
              onToggleShuffle={toggleShuffle}
              onToggleRepeat={toggleRepeat}
            />

            <ProgressBar
              currentTime={currentTime}
              duration={currentSong?.duration || 0}
              onSeek={seek}
            />
          </div>

          <div className={styles.rightSection}>
            <VolumeControl
              volume={volume}
              onVolumeChange={setVolume}
              onToggleMute={handleVolumeToggle}
            />

            <PlayerSecondaryControls
              currentSong={currentSong}
              isPlaying={isPlaying}
              isFavorite={isFavorite}
              showVisualizer={showVisualizer}
              showLyrics={showLyrics}
              isOnSafari={isOnSafari}
              onFavorite={handleFavorite}
              onVisualizerToggle={handleVisualizerToggle}
              onLyricsToggle={handleLyricsToggle}
              onPlayPause={togglePlayPause}
              onNext={next}
              onPrevious={previous}
            />

            <SongActionsDropdown
              song={currentSong}
              library={libraryState}
              onCreatePlaylist={(name: string, songs: any[]) => {
                const playlist = { id: `playlist-${Date.now()}`, name, songs };
                library.addPlaylist(playlist);
                return playlist;
              }}
              onAddToPlaylist={(playlistId: string, songId: string) => {
                const playlist = library.getPlaylist(playlistId);
                if (playlist) {
                  const song = library.getSong(songId);
                  if (song) {
                    playlist.songs.push(song);
                    library.updatePlaylist(playlistId, { songs: playlist.songs });
                  }
                }
              }}
              onAddToFavorites={(songId: string) => komorebi.toggleFavorite(songId)}
              isFavorited={(songId: string) => komorebi.isFavorite(songId)}
              onPlaySong={(song: any, playlist?: any) => komorebi.playSong(song, playlist)}
              onRemoveSong={(songId: string) => komorebi.removeSong(songId)}
              size={16}
              className={styles.moreButton}
            />
          </div>

          {(showLyrics || isLyricsClosing) && currentSong && (
            <Lyrics
              artist={currentSong.artist}
              title={currentSong.title}
              visible={showLyrics && !isLyricsClosing}
              onClose={handleLyricsToggle}
              embeddedLyrics={currentSong.embeddedLyrics}
              currentTime={currentTime}
              isClosing={isLyricsClosing}
            />
          )}
        </div>
      </>
    );
  },
);

Player.displayName = "Player";
