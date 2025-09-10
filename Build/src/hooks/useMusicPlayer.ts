import { useMemo, useRef } from "react";
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
  const initializationRef = useRef(false);

  if (!initializationRef.current) {
    console.log("useMusicPlayer: First instantiation");
    initializationRef.current = true;
  }

  // Initialize core dependencies in the correct order
  const playerSettings = usePlayerSettings();
  const songCache = useSongCache();

  // Create stable interface objects to prevent re-renders - use refs for stability
  const interfacesRef = useRef<{
    songCache: any;
    playerSettings: any;
    musicLibrary: any;
  }>({
    songCache: songCache,
    playerSettings: {},
    musicLibrary: {}
  });

  if (!interfacesRef.current) {
    interfacesRef.current = {
      songCache: {
        cacheSong: songCache.cacheSong,
        getCachedSong: songCache.getCachedSong,
        updateSongCache: songCache.updateSongCache,
        memoizedPrepareSongsForPlaylist: songCache.memoizedPrepareSongsForPlaylist,
      },
      playerSettings: {
        settings: playerSettings.settings,
        settingsRef: playerSettings.settingsRef,
        setSettings: playerSettings.setSettings,
        isInitialized: playerSettings.isInitialized,
      },
      musicLibrary: {
        setLibrary: () => { }, // Placeholder that will be updated
      },
    };
  }

  // Update the interfaces with current values but keep the same references
  interfacesRef.current.songCache = {
    cacheSong: songCache.cacheSong,
    getCachedSong: songCache.getCachedSong,
    updateSongCache: songCache.updateSongCache,
    memoizedPrepareSongsForPlaylist: songCache.memoizedPrepareSongsForPlaylist,
  };

  interfacesRef.current.playerSettings = {
    settings: playerSettings.settings,
    settingsRef: playerSettings.settingsRef,
    setSettings: playerSettings.setSettings,
    isInitialized: playerSettings.isInitialized,
  };

  // Initialize audio playback with its dependencies
  const audioPlayback = useAudioPlayback(
    interfacesRef.current.songCache,
    interfacesRef.current.musicLibrary,
    interfacesRef.current.playerSettings
  );

  // Create stable audioPlayback interface
  const audioPlaybackInterface = useMemo(() => ({
    playerState: audioPlayback.playerState,
    setPlayerState: audioPlayback.setPlayerState,
  }), [audioPlayback.playerState, audioPlayback.setPlayerState]);

  // Initialize music library with its dependencies
  const musicLibrary = useMusicLibrary(
    interfacesRef.current.songCache,
    audioPlaybackInterface,
    interfacesRef.current.playerSettings
  );

  // Update the musicLibrary interface in the ref
  interfacesRef.current.musicLibrary = {
    library: musicLibrary.library,
    setLibrary: musicLibrary.setLibrary,
  };

  // Initialize search and navigation with its dependencies
  const searchAndNavigation = useSearchAndNavigation(
    audioPlaybackInterface,
    interfacesRef.current.musicLibrary
  );

  // Return stable references
  return useMemo(() => ({
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
  }), [playerSettings, songCache, audioPlayback, musicLibrary, searchAndNavigation]);
};