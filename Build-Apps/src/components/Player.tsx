import React, { useEffect, useRef, useState, useCallback } from "react";
import { debounce } from "lodash";
import {
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Volume1,
  VolumeOff,
  Heart,
  BarChart3,
  Type,
} from "lucide-react";
import { Button } from "./Button";
import { Visualizer } from "./Visualizer";
import { Lyrics } from "./Lyrics";
import styles from "./Player.module.css";
import { SongActionsDropdown } from "./SongActionsDropdown";
import { PlayerSettings } from "./Settings";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";

type PlayerProps = {
  musicPlayerHook: ReturnType<
    typeof import("../hooks/musicPlayerHook").useMusicPlayer
  >;
  settings: PlayerSettings;
};

export const Player = ({ musicPlayerHook, settings }: PlayerProps) => {
  const { t } = useTranslation();

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const {
    playerState,
    library,
    togglePlayPause,
    playNext,
    playPrevious,
    setVolume,
    seekTo,
    addToFavorites,
    removeFromFavorites,
    toggleShuffle,
    toggleRepeat,
    createPlaylist,
    addToPlaylist,
    playSong,
    removeSong,
  } = musicPlayerHook;

  const {
    currentSong,
    isPlaying,
    currentTime,
    volume,
    shuffle,
    repeat,
    analyserNode,
  } = playerState;

  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.round(seconds);
    const shouldShowHours = currentSong && currentSong.duration >= 3600;

    if (shouldShowHours) {
      const hours = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    } else {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
  };

  const updateProgress = useCallback(
    (clientX: number) => {
      if (!progressRef.current || !currentSong) return;
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * currentSong.duration;
      seekTo(newTime);
    },
    [currentSong, seekTo]
  );

  const updateVolume = useCallback(
    (clientX: number) => {
      if (!volumeRef.current) return;
      const rect = volumeRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      setVolume(percentage);
    },
    [setVolume]
  );

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingProgress) return;
    updateProgress(e.clientX);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingVolume) return;
    updateVolume(e.clientX);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingProgress(true);
    updateProgress(e.clientX);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDraggingProgress(true);
    updateProgress(e.touches[0].clientX);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingVolume(true);
    updateVolume(e.clientX);
  };

  const handleVolumeTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDraggingVolume(true);
    updateVolume(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingProgress) updateProgress(e.clientX);
      else if (isDraggingVolume) updateVolume(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingProgress) {
        e.preventDefault();
        updateProgress(e.touches[0].clientX);
      } else if (isDraggingVolume) {
        e.preventDefault();
        updateVolume(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingProgress(false);
      setIsDraggingVolume(false);
    };

    const handleTouchEnd = () => {
      setIsDraggingProgress(false);
      setIsDraggingVolume(false);
    };

    if (isDraggingProgress || isDraggingVolume) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDraggingProgress, isDraggingVolume, updateProgress, updateVolume]);

  const handleVolumeToggle = () => {
    setVolume(volume === 0 ? 0.7 : 0);
  };

  const handleFavorite = () => {
    if (!currentSong) return;
    const isFavorite = library.favorites.includes(currentSong.id);
    if (isFavorite) removeFromFavorites(currentSong.id);
    else addToFavorites(currentSong.id);
  };

  const titleRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState("0px");
  const [animationDuration, setAnimationDuration] = useState(0);

  useEffect(() => {
    const updateScroll = () => {
      if (!titleRef.current || !currentSong) return;
      const wrapper = titleRef.current.parentElement!;
      const content = titleRef.current;

      // Sanitize the title
      const safeTitle = DOMPurify.sanitize(currentSong.title);

      content.innerHTML = safeTitle;
      const distance = content.scrollWidth - wrapper.clientWidth;

      if (distance > 0) {
        const gapWidth = 15;
        const loopDistance = content.scrollWidth + gapWidth;
        setScrollDistance(`-${loopDistance}px`);
        setAnimationDuration(Math.max(10, loopDistance / 30));
        content.classList.remove(styles.scrollable);
        void content.offsetWidth;
        content.innerHTML = `${safeTitle} &nbsp;&nbsp;&nbsp; ${safeTitle}`;
        content.classList.add(styles.scrollable);
      } else {
        setScrollDistance("0px");
        setAnimationDuration(0);
        content.classList.remove(styles.scrollable);
        content.innerHTML = safeTitle;
      }
    };

    updateScroll();
    window.addEventListener("resize", updateScroll);
    return () => window.removeEventListener("resize", updateScroll);
  }, [currentSong?.title, styles.scrollable]);

  const handleVisualizerToggle = () => setShowVisualizer((prev) => !prev);
  const handleLyricsToggle = () => setShowLyrics((prev) => !prev);

  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeOff size={16} />;
    if (volume < 0.3) return <VolumeX size={16} />;
    if (volume < 0.7) return <Volume1 size={16} />;
    return <Volume2 size={16} />;
  };

  const getRepeatTitle = () => {
    switch (repeat) {
      case "one":
        return t("player.repeatTrack");
      case "all":
        return t("player.repeatAll");
      default:
        return t("player.repeatOff");
    }
  };

  useEffect(() => {
    if (currentSong && settings?.showLyrics) setShowLyrics(true);
  }, [currentSong, settings?.showLyrics]);

  const progressPercentage = currentSong ? (currentTime / currentSong.duration) * 100 : 0;
  const volumePercentage = volume * 100;

  if (!currentSong) {
    return (
      <div className={styles.player}>
        <div className={styles.noSong}>
          <span>{t("player.selectSong")}</span>
        </div>
      </div>
    );
  }

  const isFavorite = library.favorites.includes(currentSong.id);

  return (
    <>
      {showVisualizer && (
        <div className={styles.visualizerOverlay}>
          <Visualizer analyserNode={analyserNode} isPlaying={isPlaying} className={styles.visualizer} />
        </div>
      )}
      <div className={styles.player}>
        <div className={styles.currentSong}>
          <div className={styles.albumArt}>
            {currentSong.albumArt && (
              <img
                src={currentSong.albumArt}
                alt={t("player.albumArtAlt", { title: currentSong.title })}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
              />
            )}
          </div>
          <div className={styles.songInfo}>
            <div className={styles.songTitleWrapper}>
              <div
                ref={titleRef}
                className={`${styles.songTitle} ${scrollDistance !== "0px" ? styles.scrollable : ""}`}
                style={{ "--scroll-distance": scrollDistance, animationDuration: `${animationDuration}s`, opacity: currentSong?.title ? 1 : 0 } as React.CSSProperties}
              >
                {currentSong?.title || t("player.loading")}
              </div>
            </div>
            <div className={styles.artistName}>{currentSong.artist}</div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className={`${styles.favoriteButton} ${isFavorite ? styles.favorited : ""}`}
            onClick={handleFavorite}
            title={isFavorite ? t("player.removeFavorite") : t("player.addFavorite")}
          >
            <Heart size={16} />
          </Button>
        </div>

        <div className={styles.controls}>
          <div className={styles.playbackButtons}>
            <Button variant="ghost" size="icon-sm" className={`${styles.controlButton} ${shuffle ? styles.active : ""}`} onClick={toggleShuffle} title={shuffle ? t("player.shuffleOn") : t("player.shuffleOff")}>
              <Shuffle size={16} />
            </Button>
            <Button variant="ghost" size="icon-md" className={styles.controlButton} onClick={debounce(playPrevious, 200)} title={t("player.previous")}>
              <SkipBack size={18} />
            </Button>
            <Button variant="primary" size="icon-lg" className={styles.playButton} onClick={debounce(togglePlayPause, 200)} title={isPlaying ? t("player.pause") : t("player.play")}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </Button>
            <Button variant="ghost" size="icon-md" className={styles.controlButton} onClick={debounce(playNext, 200)} title={t("player.next")}>
              <SkipForward size={18} />
            </Button>
            <Button variant="ghost" size="icon-sm" className={`${styles.controlButton} ${repeat !== "off" ? styles.active : ""} ${repeat === "one" ? styles.repeatOne : ""}`} onClick={toggleRepeat} title={getRepeatTitle()}>
              <Repeat size={16} />
            </Button>
          </div>

          <div className={styles.progressSection}>
            <span className={styles.timeDisplay}>{formatTime(currentTime)}</span>
            <div className={`${styles.progressBar} ${isDraggingProgress ? styles.dragging : ""}`} ref={progressRef} onClick={handleProgressClick} onMouseDown={handleProgressMouseDown} onTouchStart={handleProgressTouchStart} title={t("player.seek")}>
              <div className={styles.progressFill} style={{ width: `${progressPercentage}%` }}></div>
            </div>
            <span className={styles.timeDisplay}>{formatTime(currentSong.duration)}</span>
          </div>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.secondaryControls}>
            <Button variant="ghost" size="icon-sm" className={`${styles.secondaryButton} ${showVisualizer ? styles.active : ""}`} onClick={handleVisualizerToggle} title={t("player.visualizer")}>
              <BarChart3 size={16} />
            </Button>
            <Button variant="ghost" size="icon-sm" className={`${styles.secondaryButton} ${showLyrics ? styles.active : ""}`} onClick={handleLyricsToggle} title={t("player.lyrics")}>
              <Type size={16} />
            </Button>
          </div>

          <div className={styles.volumeControls}>
            <Button variant="ghost" size="icon-sm" className={styles.volumeButton} onClick={handleVolumeToggle} title={volume === 0 ? t("player.unmute") : t("player.mute")}>
              {getVolumeIcon()}
            </Button>
            <div className={`${styles.volumeBar} ${isDraggingVolume ? styles.dragging : ""}`} ref={volumeRef} onClick={handleVolumeClick} onMouseDown={handleVolumeMouseDown} onTouchStart={handleVolumeTouchStart} title={t("player.volume")}>
              <div className={styles.volumeFill} style={{ width: `${volumePercentage}%` }}></div>
            </div>
          </div>

          <SongActionsDropdown song={currentSong} library={library} onCreatePlaylist={createPlaylist} onAddToPlaylist={addToPlaylist} onPlaySong={playSong} onRemoveSong={removeSong} size={16} className={styles.moreButton} />
        </div>

        {showLyrics && currentSong && (
          <Lyrics artist={currentSong.artist} title={currentSong.title} visible={showLyrics} onClose={() => setShowLyrics(false)} />
        )}
      </div>
    </>
  );
};
