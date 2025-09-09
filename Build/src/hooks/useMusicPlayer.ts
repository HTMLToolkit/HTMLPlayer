import { useMemo } from "react";
import { usePlayerSettings } from "./usePlayerSettings";
import { useSongCache } from "./useSongCache";
import { useAudioPlayback } from "./useAudioPlayback";
import { useMusicLibrary } from "./useMusicLibrary";
import { useSearchAndNavigation } from "./useSearchAndNavigation";

/**
 * Main hook that coordinates all music player functionality.
 * This resolves circular dependencies by properly managing the initialization order.
 */
export const useMusicPlayer = () => {
  console.log("useMusicPlayer: Instantiated");

  // Initialize core dependencies in the correct order
  const playerSettings = usePlayerSettings();
  const songCache = useSongCache();
  
  // Create stable interface objects to prevent re-renders
  const songCacheInterface = useMemo(() => ({
    cacheSong: songCache.cacheSong,
    getCachedSong: songCache.getCachedSong,
    updateSongCache: songCache.updateSongCache,
    memoizedPrepareSongsForPlaylist: songCache.memoizedPrepareSongsForPlaylist,
  }), [songCache]);

  const playerSettingsInterface = useMemo(() => ({
    settings: playerSettings.settings,
    settingsRef: playerSettings.settingsRef,
    setSettings: playerSettings.setSettings,
    isInitialized: playerSettings.isInitialized,
  }), [playerSettings]);

  // Initialize audio playback with its dependencies
  const audioPlayback = useAudioPlayback(
    songCacheInterface,
    { setLibrary: () => {} }, // Placeholder, will be updated by music library
    playerSettingsInterface
  );

  const audioPlaybackInterface = useMemo(() => ({
    playerState: audioPlayback.playerState,
    setPlayerState: audioPlayback.setPlayerState,
  }), [audioPlayback]);

  // Initialize music library with its dependencies
  const musicLibrary = useMusicLibrary(
    songCacheInterface,
    audioPlaybackInterface,
    playerSettingsInterface
  );

  // Update the audio playback's music library reference
  const musicLibraryInterface = useMemo(() => ({
    library: musicLibrary.library,
    setLibrary: musicLibrary.setLibrary,
  }), [musicLibrary]);

  // Initialize search and navigation with its dependencies
  const searchAndNavigation = useSearchAndNavigation(
    audioPlaybackInterface,
    musicLibraryInterface
  );

  return {
    // Player Settings
    playerSettings: {
      ...playerSettings,
    },
    
    // Song Cache
    songCache: {
      ...songCache,
    },
    
    // Audio Playback
    audioPlayback: {
      ...audioPlayback,
    },
    
    // Music Library
    musicLibrary: {
      ...musicLibrary,
    },
    
    // Search and Navigation
    searchAndNavigation: {
      ...searchAndNavigation,
    },
  };
};