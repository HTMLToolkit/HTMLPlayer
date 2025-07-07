import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  SkipBack, Play, Pause, SkipForward, Repeat, Shuffle, 
  Volume2, VolumeX, Volume1, VolumeOff, Heart, MoreHorizontal, 
  BarChart3, Type, Plus, Info, Share, User, Music 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "./DropdownMenu";
import { Visualizer } from "./Visualizer";
import { Lyrics } from "./Lyrics";  // <-- import Lyrics component
import styles from "./Player.module.css";

type PlayerProps = {
  musicPlayerHook: ReturnType<typeof import("../helpers/musicPlayerHook").useMusicPlayer>;
};

export const Player = ({ musicPlayerHook }: PlayerProps) => {
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
    createPlaylist
  } = musicPlayerHook;

  const { currentSong, isPlaying, currentTime, volume, shuffle, repeat, analyserNode } = playerState;
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);  // <-- new state for lyrics
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateProgress = useCallback((clientX: number) => {
    if (!progressRef.current || !currentSong) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * currentSong.duration;
    
    seekTo(newTime);
  }, [currentSong, seekTo]);

  const updateVolume = useCallback((clientX: number) => {
    if (!volumeRef.current) return;
    
    const rect = volumeRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    
    setVolume(percentage);
  }, [setVolume]);

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
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingProgress, isDraggingVolume, updateProgress, updateVolume]);

  const handleVolumeToggle = () => {
    if (volume === 0) {
      setVolume(0.7); // Unmute to 70%
    } else {
      setVolume(0); // Mute
    }
  };

  const handleFavorite = () => {
    if (!currentSong) return;
    
    const isFavorite = library.favorites.includes(currentSong.id);
    if (isFavorite) {
      removeFromFavorites(currentSong.id);
    } else {
      addToFavorites(currentSong.id);
    }
  };

  const handleAddToPlaylist = () => {
    if (!currentSong) return;
    
    if (library.playlists.length === 0) {
      const defaultPlaylist = createPlaylist('My Playlist', [currentSong]);
      toast.success(`Created new playlist "${defaultPlaylist.name}" and added "${currentSong.title}"`);
      return;
    }
    
    const firstPlaylist = library.playlists[0];
    const isAlreadyInPlaylist = firstPlaylist.songs.some(song => song.id === currentSong.id);
    
    if (isAlreadyInPlaylist) {
      toast.info(`"${currentSong.title}" is already in playlist "${firstPlaylist.name}"`);
    } else {
      toast.success(`Added "${currentSong.title}" to playlist "${firstPlaylist.name}"`);
    }
  };

  const handleShowSongInfo = () => {
    if (!currentSong) return;
    
    const infoText = [
      `Title: ${currentSong.title}`,
      `Artist: ${currentSong.artist}`,
      `Album: ${currentSong.album}`,
      `Duration: ${formatTime(currentSong.duration)}`,
      `Format: Audio file`
    ].join('\n');
    
    alert(`Song Information\n\n${infoText}`);
  };

  const handleShare = async () => {
    if (!currentSong) return;
    
    const shareData = {
      title: `${currentSong.title} - ${currentSong.artist}`,
      text: `Listen to "${currentSong.title}" by ${currentSong.artist}`,
      url: window.location.href
    };
    
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success('Song shared successfully');
      } else {
        const shareText = `🎵 ${shareData.title}\n${shareData.text}\n${shareData.url}`;
        await navigator.clipboard.writeText(shareText);
        toast.success('Song info copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to share:', error);
      try {
        await navigator.clipboard.writeText(`${currentSong.title} by ${currentSong.artist}`);
        toast.success('Song info copied to clipboard');
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError);
        toast.error('Failed to share or copy song info');
      }
    }
  };

  const handleGoToArtist = () => {
    if (!currentSong) return;
    console.log(`Navigating to artist page for: ${currentSong.artist}`);
    toast.info(`Artist page for "${currentSong.artist}" (placeholder)`);
  };

  const handleGoToAlbum = () => {
    if (!currentSong) return;
    console.log(`Navigating to album page for: ${currentSong.album}`);
    toast.info(`Album page for "${currentSong.album}" (placeholder)`);
  };

  const handleVisualizerToggle = () => {
    setShowVisualizer(prev => !prev);
  };

  const handleLyricsToggle = () => {
    setShowLyrics(prev => !prev);  // toggle lyrics display
  };

  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeOff size={16} />;
    if (volume < 0.3) return <VolumeX size={16} />;
    if (volume < 0.7) return <Volume1 size={16} />;
    return <Volume2 size={16} />;
  };

  const getRepeatTitle = () => {
    switch (repeat) {
      case 'one':
        return 'Repeat: Track';
      case 'all':
        return 'Repeat: All';
      default:
        return 'Repeat: Off';
    }
  };

  const progressPercentage = currentSong ? (currentTime / currentSong.duration) * 100 : 0;
  const volumePercentage = volume * 100;

  if (!currentSong) {
    return (
      <div className={styles.player}>
        <div className={styles.noSong}>
          <span>Select a song to start playing</span>
        </div>
      </div>
    );
  }

  const isFavorite = library.favorites.includes(currentSong.id);

  return (
    <>
      {showVisualizer && (
        <div className={styles.visualizerOverlay}>
          <Visualizer 
            analyserNode={analyserNode}
            isPlaying={isPlaying}
            className={styles.visualizer}
          />
        </div>
      )}
      <div className={styles.player}>
        <div className={styles.currentSong}>
          <div className={styles.albumArt}></div>
          <div className={styles.songInfo}>
            <div className={styles.songTitle}>{currentSong.title}</div>
            <div className={styles.artistName}>{currentSong.artist}</div>
          </div>
          <Button 
            variant="ghost" 
            size="icon-sm" 
            className={`${styles.favoriteButton} ${isFavorite ? styles.favorited : ''}`}
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
              className={`${styles.controlButton} ${shuffle ? styles.active : ''}`}
              onClick={toggleShuffle}
              title={`Shuffle: ${shuffle ? 'On' : 'Off'}`}
            >
              <Shuffle size={16} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon-md" 
              className={styles.controlButton}
              onClick={playPrevious}
              title="Previous"
            >
              <SkipBack size={18} />
            </Button>
            <Button 
              variant="primary" 
              size="icon-lg" 
              className={styles.playButton}
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon-md" 
              className={styles.controlButton}
              onClick={playNext}
              title="Next"
            >
              <SkipForward size={18} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon-sm" 
              className={`${styles.controlButton} ${repeat !== 'off' ? styles.active : ''} ${repeat === 'one' ? styles.repeatOne : ''}`}
              onClick={toggleRepeat}
              title={getRepeatTitle()}
            >
              <Repeat size={16} />
            </Button>
          </div>
          
          <div className={styles.progressSection}>
            <span className={styles.timeDisplay}>{formatTime(currentTime)}</span>
            <div 
              className={`${styles.progressBar} ${isDraggingProgress ? styles.dragging : ''}`}
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
            <span className={styles.timeDisplay}>{formatTime(currentSong.duration)}</span>
          </div>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.secondaryControls}>
            <Button 
              variant="ghost" 
              size="icon-sm" 
              className={`${styles.secondaryButton} ${showVisualizer ? styles.active : ''}`}
              onClick={handleVisualizerToggle}
              title="Visualizer"
            >
              <BarChart3 size={16} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon-sm" 
              className={`${styles.secondaryButton} ${showLyrics ? styles.active : ''}`}  // active if lyrics showing
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
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {getVolumeIcon()}
            </Button>
            <div 
              className={`${styles.volumeBar} ${isDraggingVolume ? styles.dragging : ''}`}
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className={styles.moreButton}
                title="More options"
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuItem onClick={handleAddToPlaylist}>
                <Plus size={16} style={{ marginRight: 8 }} />
                Add to playlist
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleShowSongInfo}>
                <Info size={16} style={{ marginRight: 8 }} />
                Song info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare}>
                <Share size={16} style={{ marginRight: 8 }} />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleGoToArtist}>
                <User size={16} style={{ marginRight: 8 }} />
                Go to artist
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleGoToAlbum}>
                <Music size={16} style={{ marginRight: 8 }} />
                Go to album
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Lyrics overlay */}
        {showLyrics && currentSong && (
          <Lyrics 
            artist={currentSong.artist} 
            title={currentSong.title} 
            visible={showLyrics} 
            onClose={() => setShowLyrics(false)} 
          />
        )}
      </div>
    </>
  );
};
