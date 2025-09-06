import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { musicIndexedDbHelper } from "./musicIndexedDbHelper";

export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  fileData?: ArrayBuffer;
  mimeType?: string;
  hasStoredAudio?: boolean;
  albumArt?: string;
};

export type Playlist = {
  id: string;
  name: string;
  songs: Song[];
};

export type PlayerSettings = {
  volume: number;
  crossfade: number;
  crossfadeEnabled: boolean;
  colorTheme: string;
  defaultShuffle: boolean;
  defaultRepeat: "off" | "one" | "all";
  themeMode: "light" | "dark" | "auto";
  autoPlayNext: boolean;
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
  lastPlayedSongId?: string;
  lastPlayedPlaylistId?: string;
};

export type PlayerState = {
  currentSong: Song | null;
  currentPlaylist: Playlist | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  analyserNode: AnalyserNode | null;
  view: "songs" | "artist" | "album";
  currentArtist?: string;
  currentAlbum?: string;
};

export type MusicLibrary = {
  songs: Song[];
  playlists: Playlist[];
  favorites: string[];
};

// Type for cached song
type CachedSong = {
  song: Song;
  audioBuffer: ArrayBuffer;
  url: string;
  loadedAt: number;
};

// Crossfade state management
type CrossfadeState = {
  isActive: boolean;
  currentAudio: HTMLAudioElement | null;
  nextAudio: HTMLAudioElement | null;
  fadePromise: Promise<void> | null;
};

// Cache configuration
const CACHE_CONFIG = {
  PREV_SONGS: 2,
  NEXT_SONGS: 3,
  CACHE_EXPIRY: 5 * 60 * 1000, // 5 minutes
};

export const useMusicPlayer = () => {
  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRefNext = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const songCacheRef = useRef<Map<string, CachedSong>>(new Map());
  const crossfadeStateRef = useRef<CrossfadeState>({
    isActive: false,
    currentAudio: null,
    nextAudio: null,
    fadePromise: null,
  });

  // State refs for async operations
  const settingsRef = useRef<PlayerSettings>({
    volume: 0.75,
    crossfade: 3,
    crossfadeEnabled: false,
    colorTheme: "Blue",
    defaultShuffle: false,
    defaultRepeat: "off",
    autoPlayNext: true,
    themeMode: "auto",
    compactMode: false,
    showAlbumArt: true,
    showLyrics: false,
    lastPlayedSongId: "none",
    lastPlayedPlaylistId: "none",
  });
  const playerStateRef = useRef<PlayerState>({
    currentSong: null,
    currentPlaylist: null,
    isPlaying: false,
    volume: 0.75,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: "off",
    analyserNode: null,
    view: "songs",
  });
  const libraryRef = useRef<MusicLibrary>({
    songs: [],
    playlists: [],
    favorites: [],
  });

  const [isInitialized, setIsInitialized] = useState(false);

  const [playerState, setPlayerState] = useState<PlayerState>({
    currentSong: null,
    currentPlaylist: null,
    isPlaying: false,
    volume: 0.75,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: "off",
    analyserNode: null,
    view: "songs",
  });

  const [settings, setSettings] = useState<PlayerSettings>({
    volume: 0.75,
    crossfade: 3,
    crossfadeEnabled: false,
    colorTheme: "Blue",
    defaultShuffle: false,
    defaultRepeat: "off",
    autoPlayNext: true,
    themeMode: "auto",
    compactMode: false,
    showAlbumArt: true,
    showLyrics: false,
    lastPlayedSongId: "none",
    lastPlayedPlaylistId: "none",
  });

  const [library, setLibrary] = useState<MusicLibrary>(() => ({
    songs: [],
    playlists: [],
    favorites: [],
  }));

  const [searchQuery, setSearchQuery] = useState("");

  // Update refs when state changes
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  // Cache management functions
  const cacheSong = async (song: Song) => {
    if (songCacheRef.current.has(song.id)) {
      if (song.hasStoredAudio && song.url.startsWith("indexeddb://")) {
        const cached = songCacheRef.current.get(song.id);
        if (cached) return;
      }
      return;
    }

    try {
      let audioData;
      if (song.hasStoredAudio) {
        audioData = await musicIndexedDbHelper.loadSongAudio(song.id);
        if (audioData) {
          const url = URL.createObjectURL(
            new Blob([audioData.fileData], { type: audioData.mimeType })
          );
          songCacheRef.current.set(song.id, {
            song: { ...song, url },
            audioBuffer: audioData.fileData,
            url,
            loadedAt: Date.now(),
          });
          return;
        }
      }

      if (!song.url || song.url.startsWith("indexeddb://")) {
        console.error("No valid URL to fetch song from:", song.id);
        return;
      }

      const response = await fetch(song.url);
      const buffer = await response.arrayBuffer();
      const mimeType = response.headers.get("content-type") || "audio/mpeg";
      const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));

      songCacheRef.current.set(song.id, {
        song: { ...song, url },
        audioBuffer: buffer,
        url,
        loadedAt: Date.now(),
      });

      await musicIndexedDbHelper.saveSongAudio(song.id, {
        fileData: buffer,
        mimeType: mimeType,
      });
    } catch (error) {
      console.error("Failed to cache song:", error);
    }
  };

  const getCachedSong = (songId: string): CachedSong | undefined => {
    return songCacheRef.current.get(songId);
  };

  const clearExpiredCache = () => {
    const now = Date.now();
    for (const [id, cached] of songCacheRef.current.entries()) {
      if (now - cached.loadedAt > CACHE_CONFIG.CACHE_EXPIRY) {
        URL.revokeObjectURL(cached.url);
        songCacheRef.current.delete(id);
      }
    }
  };

  // Helper to prepare songs for playlist
  const prepareSongsForPlaylist = useCallback((songs: Song[]): Song[] => {
    return songs.map((song) => {
      if (song.hasStoredAudio) {
        return {
          ...song,
          url: `indexeddb://${song.id}`,
        };
      } else if (songCacheRef.current.has(song.id)) {
        const cached = songCacheRef.current.get(song.id);
        return {
          ...song,
          url: cached?.url || song.url,
        };
      }
      return song;
    });
  }, []);

  // Audio setup and control functions
  const setupAudioElement = (audio: HTMLAudioElement, url: string, volume: number) => {
    console.log('[setupAudioElement] Setting up audio element', { url, volume });
    audio.src = url;
    audio.currentTime = 0;
    audio.volume = volume;
    audio.crossOrigin = "anonymous";
  };

  const stopCrossfade = async () => {
    const crossfade = crossfadeStateRef.current;
    if (crossfade.isActive && crossfade.fadePromise) {
      crossfade.isActive = false;
      try {
        await crossfade.fadePromise;
      } catch {
        // Ignore cancellation errors
      }
      
      // Clean up audio elements after stopping crossfade
      if (audioRef.current) {
        cleanupAudioElement(audioRef.current);
      }
      if (audioRefNext.current) {
        cleanupAudioElement(audioRefNext.current);
      }
      
      // Reset audio elements to clean state
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      attachEventListeners(audioRef.current);
      
      audioRefNext.current = new Audio();
      audioRefNext.current.crossOrigin = "anonymous";
    }
  };

  const performCrossfade = async (
    fromAudio: HTMLAudioElement,
    toAudio: HTMLAudioElement,
    duration: number,
    targetVolume: number
  ): Promise<void> => {
    console.log('[performCrossfade] Starting crossfade', {
      from: fromAudio.src,
      to: toAudio.src,
      duration,
      targetVolume
    });

    const crossfade = crossfadeStateRef.current;
    crossfade.isActive = true;
    crossfade.currentAudio = fromAudio;
    crossfade.nextAudio = toAudio;

    const steps = duration * 20; // 20 steps per second
    const stepDuration = 50; // 50ms per step
    const volumeStep = targetVolume / steps;

    crossfade.fadePromise = new Promise(async (resolve, reject) => {
      try {
        console.log('[performCrossfade] Starting next audio at volume 0');
        toAudio.volume = 0;
        await toAudio.play();
        console.log('[performCrossfade] Next audio started playing');

        for (let i = 0; i < steps && crossfade.isActive; i++) {
          if (!crossfade.isActive) {
            console.log('[performCrossfade] Crossfade interrupted');
            break;
          }
          
          fromAudio.volume = Math.max(0, targetVolume - (volumeStep * i));
          toAudio.volume = Math.min(targetVolume, volumeStep * i);
          
          await new Promise(r => setTimeout(r, stepDuration));
        }

        if (crossfade.isActive) {
          console.log('[performCrossfade] Crossfade complete, cleaning up old audio');
          fromAudio.volume = 0;
          toAudio.volume = targetVolume;
          fromAudio.pause();
          fromAudio.src = "";
        }

        crossfade.isActive = false;
        console.log('[performCrossfade] Crossfade finished successfully');
        resolve();
      } catch (error) {
        crossfade.isActive = false;
        reject(error);
      }
    });

    return crossfade.fadePromise;
  };

  // Get next song in queue
  const getNextSong = (currentSong: Song, playlist: Playlist, shuffle: boolean, repeat: string): Song | null => {
    const songs = playlist.songs;
    const currentIndex = songs.findIndex(s => s.id === currentSong.id);

    if (shuffle) {
      const available = songs.filter(s => s.id !== currentSong.id);
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        return available[randomIndex];
      }
    } else {
      if (currentIndex < songs.length - 1) {
        return songs[currentIndex + 1];
      } else if (repeat === "all") {
        return songs[0];
      }
    }
    return null;
  };

  // Get previous song in queue
  const getPreviousSong = (currentSong: Song, playlist: Playlist, shuffle: boolean, repeat: string): Song | null => {
    const songs = playlist.songs;
    const currentIndex = songs.findIndex(s => s.id === currentSong.id);

    if (shuffle) {
      const available = songs.filter(s => s.id !== currentSong.id);
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        return available[randomIndex];
      }
    } else {
      if (currentIndex > 0) {
        return songs[currentIndex - 1];
      } else if (repeat === "all") {
        return songs[songs.length - 1];
      }
    }
    return null;
  };

  // Event handlers
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || crossfadeStateRef.current.isActive) return;
    setPlayerState(prev => ({
      ...prev,
      currentTime: audioRef.current?.currentTime || prev.currentTime,
    }));
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    setPlayerState(prev => ({
      ...prev,
      duration: audioRef.current?.duration || prev.duration,
    }));
  }, []);

  const handleEnded = useCallback(async () => {
    console.log('[handleEnded] Audio ended event fired');
    
    const currentSettings = settingsRef.current;
    const currentState = playerStateRef.current;

    if (!currentSettings.autoPlayNext || !currentState.currentSong || !currentState.currentPlaylist) {
      console.log('[handleEnded] Not auto-advancing:', {
        autoPlayNext: currentSettings.autoPlayNext,
        hasSong: !!currentState.currentSong,
        hasPlaylist: !!currentState.currentPlaylist
      });
      return;
    }

    if (currentState.repeat === "one" && audioRef.current) {
      console.log('[handleEnded] Repeat one, restarting song');
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }

    const nextSong = getNextSong(
      currentState.currentSong,
      currentState.currentPlaylist,
      currentState.shuffle,
      currentState.repeat
    );

    if (!nextSong) {
      console.log('[handleEnded] No next song found, stopping playback');
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
      return;
    }

    console.log('[handleEnded] Auto-advancing to:', nextSong.title);
    await playNextSongWithCrossfade(nextSong);
  }, []);

  const playNextSongWithCrossfade = async (nextSong: Song) => {
    console.log('[playNextSongWithCrossfade] Playing:', nextSong.title);
    
    const settings = settingsRef.current;
    console.log('[playNextSongWithCrossfade] Current settings:', {
      crossfadeEnabled: settings.crossfadeEnabled,
      crossfadeDuration: settings.crossfade,
      volume: settings.volume
    });
    
    await cacheSong(nextSong);
    const cachedSong = getCachedSong(nextSong.id);
    if (!cachedSong) {
      console.error('[playNextSongWithCrossfade] Failed to cache next song');
      return;
    }

    setPlayerState(prev => ({
      ...prev,
      currentSong: nextSong,
      isPlaying: true,
      currentTime: 0,
    }));
    // For auto-advance, we want to crossfade even if current audio is paused (due to ending)
    const isAutoAdvance = playerStateRef.current.isPlaying;
    const doCrossfade = settings.crossfadeEnabled && 
                       settings.crossfade > 0 && 
                       audioRef.current && 
                       audioRefNext.current &&
                       (isAutoAdvance || !audioRef.current.paused);

    console.log('[playNextSongWithCrossfade] Crossfade check:', {
      enabled: settings.crossfadeEnabled,
      duration: settings.crossfade,
      hasCurrentAudio: !!audioRef.current,
      hasNextAudio: !!audioRefNext.current,
      isCurrentPlaying: audioRef.current?.paused === false,
      isAutoAdvance,
      playerIsPlaying: playerStateRef.current.isPlaying,
      willCrossfade: doCrossfade
    });

    if (doCrossfade) {
      try {
        console.log('[playNextSongWithCrossfade] Starting crossfade process');
        setupAudioElement(audioRefNext.current!, cachedSong.url, 0);
        
        console.log('[playNextSongWithCrossfade] Initiating crossfade', {
          fromSrc: audioRef.current?.src,
          toSrc: audioRefNext.current?.src,
          duration: settings.crossfade,
          targetVolume: settings.volume
        });

        await performCrossfade(
          audioRef.current!,
          audioRefNext.current!,
          settings.crossfade,
          settings.volume
        );

        console.log('[playNextSongWithCrossfade] Crossfade complete, swapping audio elements');
        
        // Clean up old audio element before swap
        cleanupAudioElement(audioRef.current!);
        console.log('[playNextSongWithCrossfade] Cleaned up old audio element');
        
        // Move next audio to main and create new next audio
        audioRef.current = audioRefNext.current;
        audioRefNext.current = new Audio();
        audioRefNext.current.crossOrigin = "anonymous";
        console.log('[playNextSongWithCrossfade] Created new next audio element');
        
        // Attach event listeners to new active audio
        attachEventListeners(audioRef.current!);
        console.log('[playNextSongWithCrossfade] Attached event listeners to new active audio');
        
      } catch (error) {
        console.error('[playNextSongWithCrossfade] Crossfade failed:', error);
        
        // Clean up audio elements but don't revoke blobs yet
        if (audioRef.current) cleanupAudioElement(audioRef.current, false);
        if (audioRefNext.current) cleanupAudioElement(audioRefNext.current, false);
        
        // Create fresh audio element
        audioRef.current = new Audio();
        audioRef.current.crossOrigin = "anonymous";
        
        // Try to play directly with the same URL
        console.log('[playNextSongWithCrossfade] Attempting direct playback with URL:', cachedSong.url);
        setupAudioElement(audioRef.current!, cachedSong.url, settings.volume);
        attachEventListeners(audioRef.current!);
        
        try {
          await audioRef.current!.play();
          console.log('[playNextSongWithCrossfade] Direct playback successful');
        } catch (playError) {
          console.error('[playNextSongWithCrossfade] Direct playback failed:', playError);
          // Now it's safe to revoke the old blobs
          if (audioRef.current?.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
          if (audioRefNext.current?.src.startsWith('blob:')) URL.revokeObjectURL(audioRefNext.current.src);
          throw playError; // Re-throw to trigger fallback handling
        }
      }
    } else {
      // Direct play without crossfade
      console.log('[playNextSongWithCrossfade] Playing directly without crossfade');
      if (audioRef.current) {
        setupAudioElement(audioRef.current, cachedSong.url, settings.volume);
        console.log('[playNextSongWithCrossfade] Playing audio directly');
        audioRef.current.play().catch(error => {
          console.error('[playNextSongWithCrossfade] Error playing audio:', error);
        });
      }
    }
  };

  const attachEventListeners = (audio: HTMLAudioElement) => {
    // Remove old listeners first
    audio.removeEventListener("timeupdate", handleTimeUpdate);
    audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    audio.removeEventListener("ended", handleEnded);
    
    // Add new listeners
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
  };
  
  const cleanupAudioElement = (audio: HTMLAudioElement, revokeBlob: boolean = false) => {
    // Only log and process if there's a meaningful source
    const oldSrc = audio.src;
    const isValidSrc = oldSrc && !oldSrc.endsWith('/') && oldSrc !== 'about:blank';
    
    if (isValidSrc) {
      console.log('[cleanupAudioElement] Cleaning up audio element', { 
        src: oldSrc,
        revokeBlob,
        isBlob: oldSrc.startsWith('blob:')
      });
    }
    
    audio.removeEventListener("timeupdate", handleTimeUpdate);
    audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    audio.removeEventListener("ended", handleEnded);
    
    if (isValidSrc) {
      if (revokeBlob && oldSrc.startsWith('blob:')) {
        console.log('[cleanupAudioElement] Revoking blob URL:', oldSrc);
        URL.revokeObjectURL(oldSrc);
      }
      audio.src = "";
      audio.load(); // Force cleanup of resources
    }
  };

  // Audio context setup
  const setupAudioContext = useCallback(() => {
    if (!audioContextRef.current && audioRef.current) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;

      if (!sourceNodeRef.current) {
        sourceNodeRef.current = context.createMediaElementSource(audioRef.current);
      }

      sourceNodeRef.current.connect(analyser);
      analyser.connect(context.destination);

      audioContextRef.current = context;
      setPlayerState(prev => ({ ...prev, analyserNode: analyser }));
    }
  }, []);

  // Cache management for surrounding songs
  const updateSongCache = async (currentSong: Song | null, playlist: Playlist | null) => {
    if (!currentSong || !playlist) return;

    clearExpiredCache();

    const currentIndex = playlist.songs.findIndex(s => s.id === currentSong.id);
    if (currentIndex === -1) return;

    const start = Math.max(0, currentIndex - CACHE_CONFIG.PREV_SONGS);
    const end = Math.min(playlist.songs.length - 1, currentIndex + CACHE_CONFIG.NEXT_SONGS);

    let nextShuffledSong: Song | null = null;
    if (playerStateRef.current.shuffle) {
      const availableSongs = playlist.songs.filter((_, i) => i !== currentIndex);
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        nextShuffledSong = availableSongs[randomIndex];
      }
    }

    const songsToCache = new Set([
      ...playlist.songs.slice(start, end + 1),
      ...(nextShuffledSong ? [nextShuffledSong] : []),
    ]);

    const promises: Promise<void>[] = [];
    for (const song of songsToCache) {
      if (!songCacheRef.current.has(song.id)) {
        promises.push(cacheSong(song));
      }
    }

    // Remove songs that are no longer needed
    for (const [id, cached] of songCacheRef.current.entries()) {
      if (!Array.from(songsToCache).some(song => song.id === cached.song.id)) {
        URL.revokeObjectURL(cached.url);
        songCacheRef.current.delete(id);
      }
    }

    await Promise.all(promises);
  };

  // Initialize audio elements
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRefNext.current = new Audio();
    audioRefNext.current.crossOrigin = "anonymous";
    
    if (audioRef.current) {
      attachEventListeners(audioRef.current);
    }

    return () => {
      if (audioRef.current) {
        cleanupAudioElement(audioRef.current, true); // Revoke blobs on unmount
        audioRef.current.pause();
      }
      if (audioRefNext.current) {
        cleanupAudioElement(audioRefNext.current, true); // Revoke blobs on unmount
        audioRefNext.current.pause();
      }
      audioRef.current = null;
      audioRefNext.current = null;
    };
  }, [handleTimeUpdate, handleLoadedMetadata, handleEnded]);

  // Cleanup cache on unmount
  useEffect(() => {
    return () => {
      for (const [, cached] of songCacheRef.current.entries()) {
        URL.revokeObjectURL(cached.url);
      }
      songCacheRef.current.clear();
    };
  }, []);

  // Load persisted data
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const persistedLibrary = await musicIndexedDbHelper.loadLibrary();
        const persistedSettings = await musicIndexedDbHelper.loadSettings();

        if (persistedLibrary) {
          const validLibrary = {
            ...persistedLibrary,
            songs: persistedLibrary.songs.filter(
              (song: Song) => song.url && song.url !== ""
            ),
          };

          const allSongsPlaylist = {
            id: "all-songs",
            name: "All Songs",
            songs: prepareSongsForPlaylist(validLibrary.songs),
          };

          const updatedLibrary = {
            ...validLibrary,
            playlists: validLibrary.playlists.some((p) => p.id === "all-songs")
              ? validLibrary.playlists.map((p) =>
                  p.id === "all-songs"
                    ? { ...p, songs: prepareSongsForPlaylist(validLibrary.songs) }
                    : p
                )
              : [allSongsPlaylist, ...validLibrary.playlists],
          };

          setLibrary(updatedLibrary);

          let songToPlay: Song | null = null;
          let playlistToSet: Playlist | null = null;

          if (persistedSettings?.lastPlayedSongId) {
            songToPlay = updatedLibrary.songs.find(
              (s) => s.id === persistedSettings.lastPlayedSongId
            ) || null;
          }
          if (persistedSettings?.lastPlayedPlaylistId) {
            playlistToSet = updatedLibrary.playlists.find(
              (p) => p.id === persistedSettings.lastPlayedPlaylistId
            ) || null;
          }

          if (!playlistToSet || !playlistToSet.songs || playlistToSet.songs.length === 0) {
            playlistToSet = allSongsPlaylist;
          }

          if (!songToPlay && playlistToSet.songs.length > 0) {
            songToPlay = playlistToSet.songs[0];
          }

          setPlayerState(prev => ({
            ...prev,
            currentSong: songToPlay,
            currentPlaylist: playlistToSet,
            isPlaying: false,
            currentTime: 0,
            duration: songToPlay?.duration || 0,
          }));
        }

        if (persistedSettings) setSettings(persistedSettings);
      } catch (error) {
        console.error("Failed to load persisted data:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    loadPersistedData();
  }, [prepareSongsForPlaylist]);

  // Save library and settings
  useEffect(() => {
    if (!isInitialized) return;
    const saveLibrary = async () => {
      try {
        await musicIndexedDbHelper.saveLibrary(library);
      } catch (error) {
        console.error("Failed to persist library data:", error);
      }
    };
    saveLibrary();
  }, [library, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const saveSettings = async () => {
      try {
        await musicIndexedDbHelper.saveSettings(settings);
      } catch (error) {
        console.error("Failed to persist settings:", error);
      }
    };
    saveSettings();
  }, [settings, isInitialized]);

  // Update volume and other settings
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  useEffect(() => {
    setPlayerState(prev => ({
      ...prev,
      volume: settings.volume,
      shuffle: settings.defaultShuffle,
      repeat: settings.defaultRepeat,
    }));
  }, [settings.volume, settings.defaultShuffle, settings.defaultRepeat]);

  // Update last played song/playlist and media session
  useEffect(() => {
    if (!isInitialized) return;
    
    setSettings(prev => ({
      ...prev,
      lastPlayedSongId: playerState.currentSong?.id ?? prev.lastPlayedSongId,
      lastPlayedPlaylistId: playerState.currentPlaylist?.id ?? prev.lastPlayedPlaylistId,
    }));

    if ("mediaSession" in navigator && playerState.currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playerState.currentSong.title,
        artist: playerState.currentSong.artist,
        album: playerState.currentSong.album,
        artwork: playerState.currentSong.albumArt
          ? [{ src: playerState.currentSong.albumArt }]
          : [],
      });

      navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
      navigator.mediaSession.setActionHandler("nexttrack", playNext);

      return () => {
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
        }
      };
    }
  }, [playerState.currentSong, playerState.currentPlaylist, isInitialized]);

  // Update current playlist when library changes
  useEffect(() => {
    if (playerState.currentPlaylist) {
      const updatedPlaylist = library.playlists.find(
        p => p.id === playerState.currentPlaylist?.id
      );
      if (updatedPlaylist && updatedPlaylist.songs !== playerState.currentPlaylist.songs) {
        setPlayerState(prev => ({
          ...prev,
          currentPlaylist: updatedPlaylist,
        }));
      }
    }
  }, [library.playlists, playerState.currentPlaylist?.id]);

  // Public API functions
  const playSong = useCallback(async (song: Song, playlist?: Playlist) => {
    if (!song.url && !song.hasStoredAudio) {
      console.error("No URL or stored audio available for song:", song);
      toast.error(`Cannot play "${song.title}" - No audio source available`);
      return;
    }

    // Stop any ongoing crossfade
    await stopCrossfade();

    if (!audioContextRef.current) setupAudioContext();
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }

    const songToPlay = song.hasStoredAudio
      ? { ...song, url: `indexeddb://${song.id}` }
      : song;

    await cacheSong(songToPlay);
    const cachedSong = getCachedSong(song.id);
    if (!cachedSong) {
      console.error("Failed to play song: could not cache");
      return;
    }

    const preparedPlaylist = playlist
      ? { ...playlist, songs: prepareSongsForPlaylist(playlist.songs) }
      : playerStateRef.current.currentPlaylist;

    setPlayerState(prev => ({
      ...prev,
      currentSong: song,
      currentPlaylist: preparedPlaylist,
      isPlaying: true,
      currentTime: 0,
    }));

    if (audioRef.current) {
      setupAudioElement(audioRef.current, cachedSong.url, settings.volume);
      audioRef.current.play();
      
      if (playlist) {
        updateSongCache(song, playlist);
      }
    }
  }, [setupAudioContext, cacheSong, getCachedSong, updateSongCache, prepareSongsForPlaylist, settings.volume]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !playerState.currentSong) return;
    
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
    
    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play()
        .catch(() => setPlayerState(prev => ({ ...prev, isPlaying: false })));
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [playerState.isPlaying, playerState.currentSong]);

  const playNext = useCallback(async () => {
    if (!playerState.currentPlaylist || !playerState.currentSong) return;

    // Stop crossfade for manual navigation
    await stopCrossfade();

    const nextSong = getNextSong(
      playerState.currentSong,
      playerState.currentPlaylist,
      playerState.shuffle,
      playerState.repeat
    );

    if (nextSong) {
      playSong(nextSong, playerState.currentPlaylist);
    }
  }, [playerState, playSong]);

  const playPrevious = useCallback(async () => {
    if (!playerState.currentPlaylist || !playerState.currentSong) return;

    // Stop crossfade for manual navigation
    await stopCrossfade();

    const prevSong = getPreviousSong(
      playerState.currentSong,
      playerState.currentPlaylist,
      playerState.shuffle,
      playerState.repeat
    );

    if (prevSong) {
      playSong(prevSong, playerState.currentPlaylist);
    }
  }, [playerState, playSong]);

  const setVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setSettings(prev => ({ ...prev, volume: clamped }));
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayerState(prev => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      repeat: prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<PlayerSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  const processAudioBatch = useCallback(async (songs: Song[]): Promise<Song[]> => {
    const processedSongs: Song[] = [];
    const totalSongs = songs.length;
    let processedCount = 0;

    const toastId = toast.loading(`Processing 0/${totalSongs} songs...`);

    for (const song of songs) {
      if (song.url.startsWith("blob:")) {
        try {
          const res = await fetch(song.url);
          const buf = await res.arrayBuffer();
          const mimeType = res.headers.get("content-type") || "audio/mpeg";

          await musicIndexedDbHelper.saveSongAudio(song.id, {
            fileData: buf,
            mimeType,
          });

          processedSongs.push({
            ...song,
            hasStoredAudio: true,
            albumArt: song.albumArt,
          });

          processedCount++;
          toast.loading(`Processing ${processedCount}/${totalSongs} songs...`, {
            id: toastId,
            description: `Current: ${song.title}`,
          });
        } catch (error) {
          const err = error as Error;
          console.error(`Failed to process audio for song: ${song.title}`, err);
          toast.error(`Failed to process "${song.title}"`, {
            description: err.message || "Unknown error occurred",
          });
          processedSongs.push(song);
        }
      } else {
        processedSongs.push(song);
        processedCount++;
      }
    }

    toast.success(`Processed ${processedCount} songs`, { id: toastId });
    return processedSongs;
  }, []);

  const addSong = useCallback(async (song: Song) => {
    setLibrary(prev => {
      const newSongs = [...prev.songs, song];
      const allSongsPlaylistExists = prev.playlists.some(p => p.id === "all-songs");

      let newPlaylists = prev.playlists.map(p =>
        p.id === "all-songs"
          ? { ...p, songs: prepareSongsForPlaylist(newSongs) }
          : p
      );

      if (!allSongsPlaylistExists) {
        newPlaylists = [
          {
            id: "all-songs",
            name: "All Songs",
            songs: prepareSongsForPlaylist(newSongs),
          },
          ...newPlaylists,
        ];
      }
      return {
        ...prev,
        songs: newSongs,
        playlists: newPlaylists,
      };
    });

    try {
      const [processedSong] = await processAudioBatch([song]);
      setLibrary(prev => {
        const newSongs = prev.songs.map(s =>
          s.id === processedSong.id ? processedSong : s
        );
        return {
          ...prev,
          songs: newSongs,
          playlists: prev.playlists.map(p =>
            p.id === "all-songs"
              ? { ...p, songs: prepareSongsForPlaylist(newSongs) }
              : p
          ),
        };
      });
    } catch (error) {
      console.error("Failed to process song audio:", error);
      toast.error(`Failed to process "${song.title}"`, {
        description: (error as Error).message || "Unknown error occurred",
      });
    }
  }, [processAudioBatch, prepareSongsForPlaylist]);

  const removeSong = useCallback(async (songId: string) => {
    setLibrary(prev => {
      const newSongs = prev.songs.filter(s => s.id !== songId);
      const newPlaylists = prev.playlists.map(p => ({
        ...p,
        songs: p.songs.filter(s => s.id !== songId),
      }));
      return {
        ...prev,
        songs: newSongs,
        playlists: newPlaylists,
        favorites: prev.favorites.filter(id => id !== songId),
      };
    });

    try {
      await musicIndexedDbHelper.removeSongAudio(songId);
    } catch (error) {
      console.error("Failed to remove song audio from IndexedDB:", error);
    }
  }, []);

  const createPlaylist = useCallback((name: string, songs: Song[] = []) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      songs: prepareSongsForPlaylist(songs),
    };
    setLibrary(prev => ({
      ...prev,
      playlists: [...prev.playlists, newPlaylist],
    }));
    return newPlaylist;
  }, [prepareSongsForPlaylist]);

  const removePlaylist = useCallback((playlistId: string) => {
    setLibrary(prev => ({
      ...prev,
      playlists: prev.playlists.filter(p => p.id !== playlistId),
    }));
  }, []);

  const addToFavorites = useCallback((songId: string) => {
    setLibrary(prev => ({
      ...prev,
      favorites: prev.favorites.includes(songId)
        ? prev.favorites
        : [...prev.favorites, songId],
    }));
  }, []);

  const removeFromFavorites = useCallback((songId: string) => {
    setLibrary(prev => ({
      ...prev,
      favorites: prev.favorites.filter(id => id !== songId),
    }));
  }, []);

  const addToPlaylist = useCallback((playlistId: string, songId: string) => {
    setLibrary(prev => {
      const song = prev.songs.find(s => s.id === songId);
      if (!song) return prev;

      return {
        ...prev,
        playlists: prev.playlists.map(p => {
          if (p.id === playlistId) {
            if (p.songs.some(s => s.id === songId)) return p;
            return {
              ...p,
              songs: [...p.songs, song],
            };
          }
          return p;
        }),
      };
    });
  }, []);

  const toggleFavorite = useCallback((songId: string) => {
    const isFav = library.favorites.includes(songId);
    if (isFav) removeFromFavorites(songId);
    else addToFavorites(songId);
    return !isFav;
  }, [library.favorites, addToFavorites, removeFromFavorites]);

  const isFavorited = useCallback((songId: string) => {
    return library.favorites.includes(songId);
  }, [library.favorites]);

  const getFavoriteSongs = useCallback(() => {
    return library.songs.filter(s => library.favorites.includes(s.id));
  }, [library]);

  const searchSongs = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return library.songs;
    return library.songs.filter(s =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.artist.toLowerCase().includes(query.toLowerCase())
    );
  }, [library.songs]);

  const getSearchResults = useCallback(() => {
    return searchSongs(searchQuery);
  }, [searchSongs, searchQuery]);

  const navigateToArtist = useCallback((artist: string) => {
    setPlayerState(prev => ({
      ...prev,
      view: "artist",
      currentArtist: artist,
    }));
  }, []);

  const navigateToAlbum = useCallback((album: string) => {
    setPlayerState(prev => ({
      ...prev,
      view: "album",
      currentAlbum: album,
    }));
  }, []);

  const navigateToSongs = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      view: "songs",
      currentArtist: undefined,
      currentAlbum: undefined,
    }));
  }, []);

  return {
    playerState,
    library,
    settings,
    searchQuery,
    isInitialized,
    playSong,
    togglePlayPause,
    playNext,
    playPrevious,
    setVolume,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    updateSettings,
    addSong,
    removeSong,
    createPlaylist,
    removePlaylist,
    addToPlaylist,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorited,
    getFavoriteSongs,
    searchSongs,
    getSearchResults,
    setSearchQuery,
    navigateToArtist,
    navigateToAlbum,
    navigateToSongs,
  };
};