import {
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { isSafari } from "../../../platform/utils/safari";
import { prefersReducedMotion } from "../../../helpers/reducedMotion";
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
import type { Track, Playlist } from "../../../core/engine/types";

gsap.registerPlugin(useGSAP);

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

    const {
      state: navState,
      goToCurrentAlbum,
      goToCurrentArtist,
    } = useNavigation();
    const currentSong = currentTrack;
    const libraryState = library.getState();

    const [showVisualizer, setShowVisualizer] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const [isVisualizerClosing, setIsVisualizerClosing] = useState(false);
    const [isLyricsClosing, setIsLyricsClosing] = useState(false);
    const visualizerOverlayRef = useRef<HTMLDivElement>(null);

    useGSAP(
      () => {
        const overlay = visualizerOverlayRef.current;
        if (!overlay) return;
        if (isVisualizerClosing) {
          if (prefersReducedMotion()) {
            setShowVisualizer(false);
            setIsVisualizerClosing(false);
          } else {
            gsap.to(overlay, {
              yPercent: -100,
              opacity: 0,
              duration: 0.25,
              ease: "power3.in",
              onComplete: () => {
                setShowVisualizer(false);
                setIsVisualizerClosing(false);
              },
            });
          }
        } else if (showVisualizer && !prefersReducedMotion()) {
          gsap.fromTo(
            overlay,
            { yPercent: -100, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.25, ease: "power3.out" },
          );
        }
      },
      {
        dependencies: [showVisualizer, isVisualizerClosing],
        scope: visualizerOverlayRef,
      },
    );

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
      } else {
        setShowVisualizer(true);
      }
    }, [showVisualizer, isVisualizerClosing]);

    const handleLyricsToggle = useCallback(() => {
      if (showLyrics || isLyricsClosing) {
        setIsLyricsClosing(true);
      } else {
        setShowLyrics(true);
      }
    }, [showLyrics, isLyricsClosing]);

    const handleLyricsCloseComplete = useCallback(() => {
      setShowLyrics(false);
      setIsLyricsClosing(false);
    }, []);

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

    return (
      <>
        {(showVisualizer || isVisualizerClosing) && (
          <div
            ref={visualizerOverlayRef}
            className={styles.visualizerOverlay}
            data-tour="visualizer"
          >
            <Visualizer
              analyserNode={komorebi.getAnalyser()}
              isPlaying={isPlaying}
              className={styles.visualizer}
            />
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
              album={currentSong?.album}
              onAlbumClick={goToCurrentAlbum}
              onArtistClick={goToCurrentArtist}
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
              onCreatePlaylist={(name: string, songs: Track[]) => {
                const playlist = { id: `playlist-${Date.now()}`, name, songs };
                library.addPlaylist(playlist);
                return playlist;
              }}
              onAddToPlaylist={(playlistId: string, songId: string) => {
                const song = library.getSong(songId);
                if (song) library.addToPlaylist(playlistId, song);
              }}
              onAddToFavorites={(songId: string) =>
                komorebi.toggleFavorite(songId)
              }
              isFavorited={(songId: string) => komorebi.isFavorite(songId)}
              onPlaySong={(song: Track, playlist?: Playlist) =>
                komorebi.playSong(song, playlist)
              }
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
              onCloseComplete={handleLyricsCloseComplete}
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
