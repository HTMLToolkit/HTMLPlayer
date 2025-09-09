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
import { Lyrics } from "./Lyrics"; // <-- import Lyrics component
import styles from "./Player.module.css";
import { SongActionsDropdown } from "./SongActionsDropdown";

type PlayerProps = {
  // Updated type to use the main hook
  musicPlayer: ReturnType<typeof import("../hooks/useMusicPlayer").useMusicPlayer>;
};

export const Player = ({ musicPlayer }: PlayerProps) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const {
    audioPlayback: {
      playerState,
      togglePlayPause,
      playNext,
      playPrevious,
      setVolume,
      seekTo,
      toggleShuffle,
      toggleRepeat,
      playSong,
    },
    musicLibrary: {
      library,
      addToFavorites,
      removeFromFavorites,
      createPlaylist,
      addToPlaylist,
      removeSong,
    },
    playerSettings: {
      settings
    }
  } = musicPlayer;

  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false); // <-- new state for lyrics
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.round(seconds);

    const shouldShowHours = playerState.currentSong && playerState.currentSong.duration >= 3600;

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
      if (!progressRef.current || !playerState.currentSong) return;

      const rect = progressRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * playerState.currentSong.duration;

      seekTo(newTime);
    },
    [playerState.currentSong, seekTo]
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

  // Progress bar drag handlers
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingProgress(true);
    updateProgress(e.clientX);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDraggingProgress(true);
    updateProgress(e.touches[0].clientX);
  };

  // Volume bar drag handlers
  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingVolume(true);
    updateVolume(e.clientX);
  };

  const handleVolumeTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDraggingVolume(true);
    updateVolume(e.touches[0].clientX);
  };

  // Global mouse/touch move and end handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingProgress) {
        updateProgress(e.clientX);
      } else if (isDraggingVolume) {
        updateVolume(e.clientX);
      }
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
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
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
    if (playerState.volume === 0) {
      setVolume(0.7); // Unmute to 70%
    } else {
      setVolume(0); // Mute
    }
  };

  const handleFavorite = () => {
    if (!playerState.currentSong) return;

    const isFavorite = library.favorites.includes(playerState.currentSong.id);
    if (isFavorite) {
      removeFromFavorites(playerState.currentSong.id);
    } else {
      addToFavorites(playerState.currentSong.id);
    }
  };

  const titleRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState("0px");
  const [animationDuration, setAnimationDuration] = useState(0); // Initialize to 0

  useEffect(() => {
    const updateScroll = () => {
      if (!titleRef.current || !playerState.currentSong) return;
      const wrapper = titleRef.current.parentElement!;
      const content = titleRef.current;

      // Reset to single title before measuring
      content.innerHTML = playerState.currentSong.title;
      const distance = content.scrollWidth - wrapper.clientWidth;
      console.log({ scrollWidth: content.scrollWidth, clientWidth: wrapper.clientWidth, distance });

      if (distance > 0) {
        // Only scroll if title is wider than wrapper
        const gapWidth = 15; // Approximate pixel width of "&nbsp;&nbsp;&nbsp;"
        const loopDistance = content.scrollWidth + gapWidth; // Distance for one full cycle
        console.log("Scrolling setup:", { loopDistance, animationDuration: Math.max(10, loopDistance / 30), title: playerState.currentSong.title });
        setScrollDistance(`-${loopDistance}px`);
        setAnimationDuration(Math.max(10, loopDistance / 30));
        content.classList.remove(styles.scrollable);
        void content.offsetWidth; // Trigger reflow
        content.innerHTML = `${playerState.currentSong.title} &nbsp;&nbsp;&nbsp; ${playerState.currentSong.title}`; // Duplicate text
        content.classList.add(styles.scrollable);
      } else {
        // No scrolling needed for short titles
        console.log("No scrolling needed:", { scrollWidth: content.scrollWidth, clientWidth: wrapper.clientWidth, distance });
        setScrollDistance("0px");
        setAnimationDuration(0);
        content.classList.remove(styles.scrollable);
        content.innerHTML = playerState.currentSong.title;
      }
    };

    updateScroll();
    window.addEventListener("resize", updateScroll);

    return () => {
      window.removeEventListener("resize", updateScroll);
    };
  }, [playerState.currentSong?.title, styles.scrollable]);

  const handleVisualizerToggle = () => {
    setShowVisualizer((prev) => !prev);
  };

  const handleLyricsToggle = () => {
    setShowLyrics((prev) => !prev); // toggle lyrics display
  };

  const getVolumeIcon = () => {
    if (playerState.volume === 0) return <VolumeOff size={16} />;
    if (playerState.volume < 0.3) return <VolumeX size={16} />;
    if (playerState.volume < 0.7) return <Volume1 size={16} />;
    return <Volume2 size={16} />;
  };

  const getRepeatTitle = () => {
    switch (playerState.repeat) {
      case "one":
        return "Repeat: Track";
      case "all":
        return "Repeat: All";
      default:
        return "Repeat: Off";
    }
  };

  // Auto-show lyrics whenever a new song is loaded
  useEffect(() => {
    if (playerState.currentSong && settings?.showLyrics) {
      setShowLyrics(true);
    }
  }, [playerState.currentSong, settings?.showLyrics]);

  const progressPercentage = playerState.currentSong
    ? (playerState.currentTime / playerState.currentSong.duration) * 100
    : 0;
  const volumePercentage = playerState.volume * 100;

  if (!playerState.currentSong) {
    return (
      <div className={styles.player}>
        <div className={styles.noSong}>
          <span>Select a song to start playing</span>
        </div>
      </div>
    );
  }

  const isFavorite = library.favorites.includes(playerState.currentSong.id);

  return (
    <>
      {showVisualizer && (
        <div className={styles.visualizerOverlay}>
          <Visualizer
            analyserNode={playerState.analyserNode}
            isPlaying={playerState.isPlaying}
            className={styles.visualizer}
          />
        </div>
      )}
      <div className={styles.player}>
        <div className={styles.currentSong}>
          <div className={styles.albumArt}>
            {playerState.currentSong.albumArt && (
              <img
                src={playerState.currentSong.albumArt}
                alt={`${playerState.currentSong.title} album art`}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "inherit",
                }}
              />
            )}
          </div>
          <div className={styles.songInfo}>
            <div className={styles.songTitleWrapper}>
              <div
                ref={titleRef}
                className={`${styles.songTitle} ${scrollDistance !== "0px" ? styles.scrollable : ""}`}
                style={{
                  "--scroll-distance": scrollDistance,
                  animationDuration: `${animationDuration}s`,
                  opacity: playerState.currentSong?.title ? 1 : 0,
                } as React.CSSProperties}
              >
                {playerState.currentSong?.title || "Loading..."}
              </div>
            </div>
            <div className={styles.artistName}>{playerState.currentSong.artist}</div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className={`${styles.favoriteButton} ${isFavorite ? styles.favorited : ""
              }`}
            onClick={handleFavorite}
            title="Add to favorites"
          >
            <Heart size={16} />
          </Button>
        </div>

        <div className={styles.controls}>
          <div className={styles.playbackButtons}>
            <Button
              variant="ghost"
              size="icon-sm"
              className={`${styles.controlButton} ${playerState.shuffle ? styles.active : ""
                }`}
              onClick={toggleShuffle}
              title={`Shuffle: ${playerState.shuffle ? "On" : "Off"}`}
            >
              <Shuffle size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.controlButton}
              onClick={debounce(playPrevious, 200)}
              title="Previous"
            >
              <SkipBack size={18} />
            </Button>
            <Button
              variant="primary"
              size="icon-lg"
              className={styles.playButton}
              onClick={debounce(togglePlayPause, 200)}
              title={playerState.isPlaying ? "Pause" : "Play"}
            >
              {playerState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </Button>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.controlButton}
              onClick={debounce(playNext, 200)}
              title="Next"
            >
              <SkipForward size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className={`${styles.controlButton} ${playerState.repeat !== "off" ? styles.active : ""
                } ${playerState.repeat === "one" ? styles.repeatOne : ""}`}
              onClick={toggleRepeat}
              title={getRepeatTitle()}
            >
              <Repeat size={16} />
            </Button>
          </div>

          <div className={styles.progressSection}>
            <span className={styles.timeDisplay}>
              {formatTime(playerState.currentTime)}
            </span>
            <div
              className={`${styles.progressBar} ${isDraggingProgress ? styles.dragging : ""
                }`}
              ref={progressRef}
              onClick={handleProgressClick}
              onMouseDown={handleProgressMouseDown}
              onTouchStart={handleProgressTouchStart}
              title="Seek"
            >
              <div
                className={styles.progressFill}
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <span className={styles.timeDisplay}>
              {formatTime(playerState.currentSong.duration)}
            </span>
          </div>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.secondaryControls}>
            <Button
              variant="ghost"
              size="icon-sm"
              className={`${styles.secondaryButton} ${showVisualizer ? styles.active : ""
                }`}
              onClick={handleVisualizerToggle}
              title="Visualizer"
            >
              <BarChart3 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className={`${styles.secondaryButton} ${showLyrics ? styles.active : ""
                }`} // active if lyrics showing
              onClick={handleLyricsToggle}
              title="Lyrics"
            >
              <Type size={16} />
            </Button>
          </div>

          <div className={styles.volumeControls}>
            <Button
              variant="ghost"
              size="icon-sm"
              className={styles.volumeButton}
              onClick={handleVolumeToggle}
              title={playerState.volume === 0 ? "Unmute" : "Mute"}
            >
              {getVolumeIcon()}
            </Button>
            <div
              className={`${styles.volumeBar} ${isDraggingVolume ? styles.dragging : ""
                }`}
              ref={volumeRef}
              onClick={handleVolumeClick}
              onMouseDown={handleVolumeMouseDown}
              onTouchStart={handleVolumeTouchStart}
              title="Volume"
            >
              <div
                className={styles.volumeFill}
                style={{ width: `${volumePercentage}%` }}
              ></div>
            </div>
          </div>

          <SongActionsDropdown
            song={playerState.currentSong}
            library={library}
            onCreatePlaylist={createPlaylist}
            onAddToPlaylist={addToPlaylist}
            onPlaySong={playSong}
            onRemoveSong={removeSong}
            size={16}
            className={styles.moreButton}
          />
        </div>

        {/* Lyrics overlay */}
        {showLyrics && playerState.currentSong && (
          <Lyrics
            artist={playerState.currentSong.artist}
            title={playerState.currentSong.title}
            visible={showLyrics}
            onClose={() => setShowLyrics(false)}
          />
        )}
      </div>
    </>
  );
};
