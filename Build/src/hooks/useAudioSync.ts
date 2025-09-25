import { useEffect, useCallback, useRef } from 'react';
import { useAudioStore, useAudioEvents } from '../contexts/audioStore';

interface AudioSyncProps {
  musicPlayerHook: ReturnType<typeof import('../hooks/musicPlayerHook').useMusicPlayer>;
  isMiniplayer?: boolean;
}

export const useAudioSync = ({ musicPlayerHook, isMiniplayer = false }: AudioSyncProps) => {
  const { 
    setPlaying, 
    setCurrentTime, 
    setVolume, 
    setCurrentSong, 
    setDuration, 
    play, 
    pause, 
    next, 
    previous, 
    seek, 
    changeVolume 
  } = useAudioStore();
  const { playerState, togglePlayPause, playNext, playPrevious, setVolume: playerSetVolume, seekTo } = musicPlayerHook;

  const source = isMiniplayer ? 'pip' : 'main';
  
  // Use refs to prevent dependency changes from causing infinite loops
  const stableRefs = useRef({
    togglePlayPause,
    playNext,
    playPrevious,
    playerSetVolume,
    seekTo
  });
  
  // Update refs on each render but don't cause re-renders
  stableRefs.current = {
    togglePlayPause,
    playNext,
    playPrevious,
    playerSetVolume,
    seekTo
  };

  // Check if crossfading to avoid syncing during transitions
  const isCrossfading = (musicPlayerHook as any).crossfadeManagerRef?.current?.isCrossfading?.() || false;

  // Sync state from music player to audio store (one-way sync)
  // Skip syncing during crossfade to avoid conflicts
  useEffect(() => {
    if (!isCrossfading) {
      setPlaying(playerState.isPlaying, source);
    }
  }, [playerState.isPlaying, setPlaying, source, isCrossfading]);

  useEffect(() => {
    if (!isCrossfading) {
      setCurrentTime(playerState.currentTime, source);
    }
  }, [playerState.currentTime, setCurrentTime, source, isCrossfading]);

  useEffect(() => {
    if (!isCrossfading) {
      setVolume(playerState.volume, source);
    }
  }, [playerState.volume, setVolume, source, isCrossfading]);

  useEffect(() => {
    if (!isCrossfading) {
      setCurrentSong(playerState.currentSong, source);
    }
  }, [playerState.currentSong, setCurrentSong, source, isCrossfading]);

  useEffect(() => {
    if (playerState.currentSong?.duration) {
      setDuration(playerState.currentSong.duration, source);
    }
  }, [playerState.currentSong?.duration, setDuration, source]);

  // Create stable callbacks to prevent infinite loops
  const handlePlayEvent = useCallback((event: any) => {
    // Only respond to events from other sources
    if (event.source !== source && !playerState.isPlaying) {
      console.log(`[${source}] Received play event from ${event.source}`);
      stableRefs.current.togglePlayPause();
    }
  }, [source, playerState.isPlaying]);

  const handlePauseEvent = useCallback((event: any) => {
    // Only respond to events from other sources
    if (event.source !== source && playerState.isPlaying) {
      console.log(`[${source}] Received pause event from ${event.source}`);
      stableRefs.current.togglePlayPause();
    }
  }, [source, playerState.isPlaying]);

  const handleNextEvent = useCallback((event: any) => {
    if (event.source !== source) {
      console.log(`[${source}] Received next event from ${event.source}`);
      stableRefs.current.playNext();
    }
  }, [source]);

  const handlePreviousEvent = useCallback((event: any) => {
    if (event.source !== source) {
      console.log(`[${source}] Received previous event from ${event.source}`);
      stableRefs.current.playPrevious();
    }
  }, [source]);

  const handleVolumeEvent = useCallback((event: any) => {
    if (event.source !== source && event.payload?.volume !== playerState.volume) {
      console.log(`[${source}] Received volume event from ${event.source}:`, event.payload.volume);
      stableRefs.current.playerSetVolume(event.payload.volume);
    }
  }, [source, playerState.volume]);

  const handleSeekEvent = useCallback((event: any) => {
    if (event.source !== source && Math.abs(event.payload?.time - playerState.currentTime) > 1) {
      console.log(`[${source}] Received seek event from ${event.source}:`, event.payload.time);
      stableRefs.current.seekTo(event.payload.time);
    }
  }, [source, playerState.currentTime]);

  // Listen for events from other windows and translate them to music player actions
  useAudioEvents('play', handlePlayEvent);
  useAudioEvents('pause', handlePauseEvent);
  useAudioEvents('next', handleNextEvent);
  useAudioEvents('previous', handlePreviousEvent);
  useAudioEvents('volume', handleVolumeEvent);
  useAudioEvents('seek', handleSeekEvent);

  // Return audio store controls for the miniplayer
  return {
    audioControls: {
      play: () => play(source),
      pause: () => pause(source),
      next: () => next(source),
      previous: () => previous(source),
      seek: (time: number) => seek(time, source),
      setVolume: (volume: number) => changeVolume(volume, source),
      togglePlayPause: () => {
        if (playerState.isPlaying) {
          pause(source);
        } else {
          play(source);
        }
      }
    }
  };
};