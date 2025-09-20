import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { toggleMiniplayer } from "../components/Miniplayer";
import { CrossfadeManager, AudioSource } from "../helpers/crossfadeHelper";
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

export interface PlayerSettings {
  volume: number;
  crossfade: number;
  colorTheme: string;
  defaultShuffle: boolean;
  defaultRepeat: "off" | "one" | "all";
  autoPlayNext: boolean;
  themeMode: "light" | "dark" | "auto";
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
  sessionRestore: boolean;
  lastPlayedSongId?: string;
  lastPlayedPlaylistId?: string;
  language: string;
  tempo: number;
  gapless?: boolean;
}

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

// Cache configuration
const CACHE_CONFIG = {
  PREV_SONGS: 2, // Number of previous songs to cache
  NEXT_SONGS: 3, // Number of next songs to cache
  CACHE_EXPIRY: 5 * 60 * 1000, // 5 minutes in milliseconds
};

export const useMusicPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const songCacheRef = useRef<Map<string, CachedSong>>(new Map());

  // Crossfade-related refs
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeManagerRef = useRef<CrossfadeManager | null>(null);
  const currentAudioSourceRef = useRef<AudioSource | null>(null);
  const nextAudioSourceRef = useRef<AudioSource | null>(null);
  const crossfadeTimeoutRef = useRef<number | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const playNextRef = useRef<(() => void) | null>(null);

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
    colorTheme: "Blue",
    defaultShuffle: false,
    defaultRepeat: "off",
    autoPlayNext: true,
    themeMode: "auto",
    compactMode: false,
    showAlbumArt: true,
    showLyrics: false,
    sessionRestore: true,
    lastPlayedSongId: "none",
    lastPlayedPlaylistId: "none",
    language: "English",
    tempo: 1,
    gapless: false
  });

  const [library, setLibrary] = useState<MusicLibrary>(() => ({
    songs: [],
    playlists: [],
    favorites: [],
  }));

  const [searchQuery, setSearchQuery] = useState("");

  const settingsRef = useRef(settings);
  const playerStateRef = useRef(playerState);
  const libraryRef = useRef(library);

  // Cache management functions
  const cacheSong = async (song: Song) => {
    // Check if song is already cached by ID
    if (songCacheRef.current.has(song.id)) {
      // Update the cached song's URL if it's from IndexedDB
      if (song.hasStoredAudio && song.url.startsWith("indexeddb://")) {
        const cached = songCacheRef.current.get(song.id);
        if (cached) {
          return; // URL is still valid
        }
      }
      return;
    }

    try {
      let audioData;
      // First try to load from IndexedDB
      if (song.hasStoredAudio) {
        audioData = await musicIndexedDbHelper.loadSongAudio(song.id);
        if (audioData) {
          const url = URL.createObjectURL(
            new Blob([audioData.fileData], { type: audioData.mimeType })
          );
          songCacheRef.current.set(song.id, {
            song: { ...song, url }, // Update song with real URL
            audioBuffer: audioData.fileData,
            url,
            loadedAt: Date.now(),
          });
          return;
        }
      }

      // If not in IndexedDB or failed to load, fetch from original URL
      // Don't try to fetch if we don't have a real URL
      if (!song.url || song.url.startsWith("indexeddb://")) {
        console.error("No valid URL to fetch song from:", song.id);
        return;
      }

      const response = await fetch(song.url);
      const buffer = await response.arrayBuffer();
      const mimeType = response.headers.get("content-type") || "audio/mpeg";
      const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));

      // Cache in memory
      songCacheRef.current.set(song.id, {
        song: { ...song, url }, // Update song with real URL
        audioBuffer: buffer,
        url,
        loadedAt: Date.now(),
      });

      // Save to IndexedDB for future use
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

  // Helper to ensure playlist songs have correct URLs
  const prepareSongsForPlaylist = useCallback((songs: Song[]): Song[] => {
    return songs.map((song) => {
      if (song.hasStoredAudio) {
        // Always use indexeddb:// URL for stored songs
        return {
          ...song,
          url: `indexeddb://${song.id}`,
        };
      } else if (songCacheRef.current.has(song.id)) {
        // If song is in cache, use its cached URL
        const cached = songCacheRef.current.get(song.id);
        return {
          ...song,
          url: cached?.url || song.url,
        };
      }
      return song;
    });
  }, []);

  const updateSongCache = async (
    currentSong: Song | null,
    playlist: Playlist | null
  ) => {
    if (!currentSong || !playlist) return;

    clearExpiredCache();

    const currentIndex = playlist.songs.findIndex(
      (s) => s.id === currentSong.id
    );
    if (currentIndex === -1) return;

    // Get the range of songs to cache
    const start = Math.max(0, currentIndex - CACHE_CONFIG.PREV_SONGS);
    const end = Math.min(
      playlist.songs.length - 1,
      currentIndex + CACHE_CONFIG.NEXT_SONGS
    );

    // Get next shuffled song if shuffle is enabled
    let nextShuffledSong: Song | null = null;
    if (playerStateRef.current.shuffle) {
      const availableSongs = playlist.songs.filter(
        (_, i) => i !== currentIndex
      );
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        nextShuffledSong = availableSongs[randomIndex];
      }
    }

    // Create a set of songs to cache
    const songsToCache = new Set([
      ...playlist.songs.slice(start, end + 1),
      ...(nextShuffledSong ? [nextShuffledSong] : []),
    ]);

    // Cache new songs and remove old ones
    const promises: Promise<void>[] = [];
    for (const song of songsToCache) {
      if (!songCacheRef.current.has(song.id)) {
        promises.push(cacheSong(song));
      }
    }

    // Remove songs that are no longer needed
    for (const [id, cached] of songCacheRef.current.entries()) {
      // Compare by ID instead of full song object
      if (
        !Array.from(songsToCache).some((song) => song.id === cached.song.id)
      ) {
        URL.revokeObjectURL(cached.url);
        songCacheRef.current.delete(id);
      }
    }

    await Promise.all(promises);
  };

  const getValidTempo = (tempo: number | undefined) => {
    if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo <= 0) {
      return 1; // fallback to normal speed
    }
    return tempo;
  };

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
          // Create or ensure All Songs playlist exists with prepared songs
          const allSongsPlaylist = {
            id: "all-songs",
            name: "All Songs",
            songs: prepareSongsForPlaylist(validLibrary.songs),
          };

          // Add or update All Songs playlist
          const updatedLibrary = {
            ...validLibrary,
            playlists: validLibrary.playlists.some((p) => p.id === "all-songs")
              ? validLibrary.playlists.map((p) =>
                p.id === "all-songs"
                  ? {
                    ...p,
                    songs: prepareSongsForPlaylist(validLibrary.songs),
                  }
                  : p
              )
              : [allSongsPlaylist, ...validLibrary.playlists],
          };

          setLibrary(updatedLibrary);

          let songToPlay: Song | null = null;
          let playlistToSet: Playlist | null = null;

          // Only restore session if sessionRestore is enabled
          if (persistedSettings?.sessionRestore !== false) {
            if (persistedSettings?.lastPlayedSongId) {
              songToPlay =
                updatedLibrary.songs.find(
                  (s) => s.id === persistedSettings.lastPlayedSongId
                ) || null;
            }
            if (persistedSettings?.lastPlayedPlaylistId) {
              playlistToSet =
                updatedLibrary.playlists.find(
                  (p) => p.id === persistedSettings.lastPlayedPlaylistId
                ) || null;
            }
          }

          // Default to All Songs playlist if none set or if last played playlist doesn't exist
          if (
            !playlistToSet ||
            !playlistToSet.songs ||
            playlistToSet.songs.length === 0
          ) {
            playlistToSet = allSongsPlaylist;
          }

          // If no song set but we have songs and session restore is enabled, play the first one from the current playlist
          if (!songToPlay && playlistToSet.songs.length > 0 && persistedSettings?.sessionRestore !== false) {
            songToPlay = playlistToSet.songs[0];
          }

          setPlayerState((prev) => ({
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
  }, []);

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

  const setupAudioContext = useCallback(() => {
    if (!audioContextRef.current && audioRef.current) {
      const context = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;

      // Initialize crossfade manager
      if (!crossfadeManagerRef.current) {
        crossfadeManagerRef.current = new CrossfadeManager(context);
      }

      // Setup current audio source
      if (!currentAudioSourceRef.current) {
        currentAudioSourceRef.current = crossfadeManagerRef.current.createAudioSource(audioRef.current);
        crossfadeManagerRef.current.setCurrentSource(currentAudioSourceRef.current);
      }

      // Connect analyzer to the crossfade manager's master gain
      currentAudioSourceRef.current.sourceNode.connect(analyser);

      audioContextRef.current = context;
      setPlayerState((prev) => ({ ...prev, analyserNode: analyser }));
    }
  }, []);

  // Cleanup cache on unmount
  useEffect(() => {
    return () => {
      // Cleanup crossfade manager
      if (crossfadeManagerRef.current) {
        crossfadeManagerRef.current.destroy();
      }

      // Clear any crossfade timeout
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
      }

      // Revoke all object URLs and clear the cache
      for (const [, cached] of songCacheRef.current.entries()) {
        URL.revokeObjectURL(cached.url);
      }
      songCacheRef.current.clear();
    };
  }, []);

  // Crossfade helper functions
  const getNextSongForCrossfade = (): Song | null => {
    if (!playerStateRef.current.currentPlaylist || !playerStateRef.current.currentSong) {
      return null;
    }

    const songs = playerStateRef.current.currentPlaylist.songs;
    const currentIndex = songs.findIndex(s => s.id === playerStateRef.current.currentSong!.id);

    if (playerStateRef.current.shuffle) {
      const available = songs.filter(s => s.id !== playerStateRef.current.currentSong!.id);
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        return available[randomIndex];
      }
    } else {
      if (currentIndex < songs.length - 1) {
        return songs[currentIndex + 1];
      } else if (playerStateRef.current.repeat === "all") {
        return songs[0];
      }
    }

    return null;
  };

  const prepareNextSongForCrossfade = async (nextSong: Song) => {
    if (!nextAudioRef.current || !crossfadeManagerRef.current) return;

    // Check if song is already preloaded
    if (nextAudioRef.current.src && !nextAudioRef.current.src.includes('about:blank')) {
      // Song is already preloaded, just set up the audio source
      if (!nextAudioSourceRef.current) {
        nextAudioSourceRef.current = crossfadeManagerRef.current.createAudioSource(nextAudioRef.current);
      }
      crossfadeManagerRef.current.prepareNextSource(nextAudioSourceRef.current);
      return;
    }

    // Song not preloaded, do full preparation
    await cacheSong(nextSong);
    const cachedSong = getCachedSong(nextSong.id);
    if (!cachedSong) {
      throw new Error('Failed to cache next song for crossfade');
    }

    // Set up the next audio element
    nextAudioRef.current.src = cachedSong.url;
    nextAudioRef.current.playbackRate = getValidTempo(settingsRef.current.tempo);

    // Create audio source for crossfade manager
    if (!nextAudioSourceRef.current) {
      nextAudioSourceRef.current = crossfadeManagerRef.current.createAudioSource(nextAudioRef.current);
    }

    // Prepare for crossfade
    crossfadeManagerRef.current.prepareNextSource(nextAudioSourceRef.current);
  };

  const updatePlayerStateAfterCrossfade = (nextSong: Song) => {
    // Swap audio elements - next becomes current
    const tempAudio = audioRef.current;
    audioRef.current = nextAudioRef.current;
    nextAudioRef.current = tempAudio;

    // Swap audio sources
    const tempSource = currentAudioSourceRef.current;
    currentAudioSourceRef.current = nextAudioSourceRef.current;
    nextAudioSourceRef.current = tempSource;

    // Update player state
    setPlayerState(prev => ({
      ...prev,
      currentSong: nextSong,
      currentTime: 0,
      isPlaying: true,
    }));
  };

  useEffect(() => {
    // Initialize primary audio element
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.controls = true; // Enable browser controls

    // Initialize secondary audio element for crossfading
    nextAudioRef.current = new Audio();
    nextAudioRef.current.crossOrigin = "anonymous";
    nextAudioRef.current.controls = true;

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      
      setPlayerState((prev) => ({
        ...prev,
        currentTime: currentAudio.currentTime,
      }));

      // Debug the crossfade conditions first
      const crossfadeEnabled = settingsRef.current.crossfade > 0;
      const autoPlayNext = settingsRef.current.autoPlayNext;
      const playNextAvailable = !!playNextRef.current;
      const notRepeatOne = playerStateRef.current.repeat !== "one";
      const hasDuration = currentAudio.duration > 0;
      const notCrossfading = !crossfadeManagerRef.current?.isCrossfading();

      // Handle crossfade timing - start crossfade before song ends
      if (
        crossfadeEnabled &&
        autoPlayNext &&
        playNextAvailable &&
        notRepeatOne &&
        hasDuration &&
        notCrossfading
      ) {
        const timeRemaining = currentAudio.duration - currentAudio.currentTime;
        const crossfadeDuration = settingsRef.current.crossfade;
        const preloadTime = Math.max(crossfadeDuration + 2, 5); // Preload 2 seconds before crossfade starts, minimum 5 seconds
        
        // Preload next song early
        if (timeRemaining <= preloadTime && timeRemaining > preloadTime - 0.5) {
          preloadNextSong();
        }
        
        // Start crossfade when time remaining equals crossfade duration
        if (timeRemaining <= crossfadeDuration && timeRemaining > crossfadeDuration - 0.5) {
          console.log('Triggering crossfade at', timeRemaining.toFixed(1), 'seconds remaining');
          startCrossfadeTransition();
        }
      }
    };

    const preloadNextSong = async () => {
      if (!nextAudioRef.current || crossfadeManagerRef.current?.isCrossfading()) {
        return;
      }

      const nextSong = getNextSongForCrossfade();
      if (!nextSong) return;

      try {
        // Cache the next song without starting playback
        await cacheSong(nextSong);
        const cachedSong = getCachedSong(nextSong.id);
        if (cachedSong) {
          // Pre-set the source but don't play yet
          nextAudioRef.current.src = cachedSong.url;
          nextAudioRef.current.playbackRate = getValidTempo(settingsRef.current.tempo);
          console.log('Preloaded next song for crossfade:', nextSong.title);
        }
      } catch (error) {
        console.warn('Failed to preload next song:', error);
      }
    };

    const handleLoadedMetadata = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      
      setPlayerState((prev) => ({
        ...prev,
        duration: currentAudio.duration,
      }));
    };

    const handleEnded = () => {
      // If crossfade is in progress, don't handle ending normally
      if (crossfadeManagerRef.current?.isCrossfading()) {
        return;
      }

      if (settingsRef.current.autoPlayNext) {
        if (playerStateRef.current.repeat === "one") {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          }
        } else if (playNextRef.current) {
          // If crossfade is disabled or very short, use traditional gapless/delay logic
          if (settingsRef.current.crossfade === 0) {
            if (settingsRef.current.gapless) {
              playNextRef.current();
            } else {
              setTimeout(() => playNextRef.current?.(), 400);
            }
          }
          // If crossfade is enabled, the transition should have already started in handleTimeUpdate
        }
      }
    };

    const startCrossfadeTransition = async () => {  
      if (!playNextRef.current || !crossfadeManagerRef.current || !nextAudioRef.current) {
        return;
      }

      try {
        // Get the next song info (this is a bit tricky since we need to predict what playNext will play)
        const nextSong = getNextSongForCrossfade();
        if (!nextSong) {
          console.warn('No next song found for crossfade');
          return;
        }

        // Prepare the next audio source
        await prepareNextSongForCrossfade(nextSong);

        // Start the crossfade
        await crossfadeManagerRef.current.startCrossfade({
          duration: settingsRef.current.crossfade,
          curve: 'exponential'
        });

        // Update current song state after crossfade completes
        console.log('Crossfade completed, updating state');
        updatePlayerStateAfterCrossfade(nextSong);

      } catch (error) {
        console.error('Crossfade failed:', error);
        // Fallback to regular transition
        playNextRef.current();
      }
    };


    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    // Also attach event listeners to the secondary audio element for crossfading
    const nextAudio = nextAudioRef.current;
    nextAudio.addEventListener("timeupdate", handleTimeUpdate);
    nextAudio.addEventListener("loadedmetadata", handleLoadedMetadata);
    nextAudio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      
      nextAudio.removeEventListener("timeupdate", handleTimeUpdate);
      nextAudio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      nextAudio.removeEventListener("ended", handleEnded);
      
      audio.pause();
      nextAudio.pause();
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  useEffect(() => {
    if (playerState.currentPlaylist) {
      const updatedPlaylist = library.playlists.find(
        (p) => p.id === playerState.currentPlaylist?.id
      );
      if (updatedPlaylist && updatedPlaylist.songs !== playerState.currentPlaylist.songs) {
        setPlayerState((prev) => ({
          ...prev,
          currentPlaylist: updatedPlaylist,
        }));
      }
    }
  }, [library.playlists, playerState.currentPlaylist?.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  useEffect(() => {
    setPlayerState((prev) => ({
      ...prev,
      volume: settings.volume,
      shuffle: settings.defaultShuffle,
      repeat: settings.defaultRepeat,
    }));
  }, [settings.volume, settings.defaultShuffle, settings.defaultRepeat]);

  useEffect(() => {
    if (!isInitialized) return;
    // Update last played song and playlist IDs in settings when they change (only if sessionRestore is enabled)
    if (settings.sessionRestore) {
      setSettings((prev) => ({
        ...prev,
        lastPlayedSongId: playerState.currentSong?.id ?? prev.lastPlayedSongId,
        lastPlayedPlaylistId:
          playerState.currentPlaylist?.id ?? prev.lastPlayedPlaylistId,
      }));
    }

    // Update Media Session metadata with album art
    if ("mediaSession" in navigator && playerState.currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playerState.currentSong.title,
        artist: playerState.currentSong.artist,
        album: playerState.currentSong.album,
        artwork: playerState.currentSong.albumArt
          ? [
            {
              src: playerState.currentSong.albumArt,
            },
          ]
          : [],
      });

      // Set up Media Session action handlers for previous and next track
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playPrevious();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playNext();
      });


      navigator.mediaSession.setActionHandler("enterpictureinpicture" as any, () => {
        toggleMiniplayer({
          playerState: {
            currentSong: playerState.currentSong,
            isPlaying: playerState.isPlaying
          },
          togglePlayPause,
          playNext,
          playPrevious
        });
      });

      return () => {
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
          navigator.mediaSession.setActionHandler("enterpictureinpicture" as any, null);
        }
      };
    }
  }, [playerState.currentSong, playerState.currentPlaylist, isInitialized]);

  const playSong = useCallback(
    async (song: Song, playlist?: Playlist) => {
      // Even if URL is empty, we might have it in IndexedDB
      if (!song.url && !song.hasStoredAudio) {
        console.error("No URL or stored audio available for song:", song);
        toast.error(`Cannot play "${song.title}" - No audio source available`);
        return;
      }

      if (!audioContextRef.current) setupAudioContext();
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }

      // Prepare song for playing, handling both IndexedDB and direct URLs
      const songToPlay = song.hasStoredAudio
        ? {
          ...song,
          url: `indexeddb://${song.id}`, // Use indexeddb:// URL
        }
        : song;

      // First ensure the song is cached
      await cacheSong(songToPlay);
      const cachedSong = getCachedSong(song.id);
      if (!cachedSong) {
        console.error("Failed to play song: could not cache");
        return;
      }

      // Prepare playlist songs if setting a new playlist
      const preparedPlaylist = playlist
        ? {
          ...playlist,
          songs: prepareSongsForPlaylist(playlist.songs),
        }
        : playerStateRef.current.currentPlaylist;

      setPlayerState((prev) => ({
        ...prev,
        currentSong: song,
        currentPlaylist: preparedPlaylist,
        isPlaying: true,
        currentTime: 0,
      }));

      if (audioRef.current) {
        // Cancel any ongoing crossfade
        if (crossfadeManagerRef.current?.isCrossfading()) {
          crossfadeManagerRef.current.cancelCrossfade();
        }

        // Use the cached URL instead of the original URL
        audioRef.current.src = cachedSong.url;

        // Apply persisted tempo immediately
        audioRef.current.playbackRate = getValidTempo(settingsRef.current.tempo);

        // Set up crossfade manager if not already done
        if (!audioContextRef.current) setupAudioContext();
        if (crossfadeManagerRef.current && !currentAudioSourceRef.current) {
          currentAudioSourceRef.current = crossfadeManagerRef.current.createAudioSource(audioRef.current);
          crossfadeManagerRef.current.setCurrentSource(currentAudioSourceRef.current);
        }

        try {
          await audioRef.current.play().catch(async (error: any) => {
            if (
              error.name === "NotSupportedError" &&
              song.fileData &&
              song.mimeType
            ) {
              try {
                const blob = new Blob([song.fileData], { type: song.mimeType });
                const newUrl = URL.createObjectURL(blob);
                const updatedSong = { ...song, url: newUrl };

                setPlayerState((prev) => ({ ...prev, currentSong: updatedSong }));
                setLibrary((prev) => ({
                  ...prev,
                  songs: prev.songs.map((s) =>
                    s.id === song.id ? updatedSong : s
                  ),
                }));

                audioRef.current!.src = newUrl;
                await audioRef.current!.play();
              } catch {
                setPlayerState((prev) => ({ ...prev, isPlaying: false }));
              }
            } else {
              console.error("Failed to play song:", error);
              toast.error(`Failed to play "${song.title}"`, {
                description: error.message || "Unknown error occurred",
              });
              setPlayerState((prev) => ({ ...prev, isPlaying: false }));
            }
          });
        } catch (error: any) {
          console.error("Failed to play song:", error);
          toast.error(`Failed to play "${song.title}"`, {
            description: error.message || "Unknown error occurred",
          });
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
        }

        // Update the cache for surrounding songs and next shuffled song
        if (playlist) {
          updateSongCache(song, playlist);
        }
      }
    },
    [
      setupAudioContext,
      cacheSong,
      getCachedSong,
      updateSongCache,
      prepareSongsForPlaylist,
    ]
  );

  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current || !playerState.currentSong) return;
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      // Check if audio source is loaded
      if (!audioRef.current.src || audioRef.current.src.includes('about:blank')) {
        // Audio source not loaded, need to load the song first
        await playSong(playerState.currentSong, playerState.currentPlaylist || undefined);
        return; // playSong will set isPlaying to true
      }
      
      audioRef.current
        .play()
        .catch(() => setPlayerState((prev) => ({ ...prev, isPlaying: false })));
      setPlayerState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [playerState.isPlaying, playerState.currentSong, playerState.currentPlaylist, playSong]);

  const playNext = useCallback(() => {
    if (!playerState.currentPlaylist || !playerState.currentSong) return;

    // Cancel any ongoing crossfade when user manually skips
    if (crossfadeManagerRef.current?.isCrossfading()) {
      crossfadeManagerRef.current.cancelCrossfade();
    }

    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s) => s.id === playerState.currentSong!.id
    );

    if (playerState.shuffle) {
      const available = songs.filter(
        (s) => s.id !== playerState.currentSong!.id
      );
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        playSong(available[randomIndex], playerState.currentPlaylist);
      }
    } else {
      if (currentIndex < songs.length - 1) {
        playSong(songs[currentIndex + 1], playerState.currentPlaylist);
      } else if (playerState.repeat === "all") {
        playSong(songs[0], playerState.currentPlaylist);
      }
    }
  }, [playerState, playSong]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const playPrevious = useCallback(() => {
    if (!playerState.currentPlaylist || !playerState.currentSong) return;

    // Cancel any ongoing crossfade when user manually skips
    if (crossfadeManagerRef.current?.isCrossfading()) {
      crossfadeManagerRef.current.cancelCrossfade();
    }

    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s) => s.id === playerState.currentSong!.id
    );

    if (playerState.shuffle) {
      const available = songs.filter(
        (s) => s.id !== playerState.currentSong!.id
      );
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        playSong(available[randomIndex], playerState.currentPlaylist);
      }
    } else {
      if (currentIndex > 0) {
        playSong(songs[currentIndex - 1], playerState.currentPlaylist);
      } else if (playerState.repeat === "all") {
        playSong(songs[songs.length - 1], playerState.currentPlaylist);
      }
    }
  }, [playerState, playSong]);

  const setVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setSettings((prev) => ({ ...prev, volume: clamped }));
    
    // Use crossfade manager for volume control if available, otherwise direct control
    if (crossfadeManagerRef.current) {
      crossfadeManagerRef.current.setMasterVolume(clamped);
    } else if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayerState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setPlayerState((prev) => ({
      ...prev,
      repeat:
        prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<PlayerSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState((prev) => ({ ...prev, currentTime: time }));
    }
  }, []);

  const processAudioBatch = useCallback(
    async (songs: Song[]): Promise<Song[]> => {
      const processedSongs: Song[] = [];
      const totalSongs = songs.length;
      let processedCount = 0;

      // Show initial toast
      const toastId = toast.loading(`Processing 0/${totalSongs} songs...`);

      for (const song of songs) {
        if (song.url.startsWith("blob:")) {
          try {
            // Load the audio data
            const res = await fetch(song.url);
            const buf = await res.arrayBuffer();
            const mimeType = res.headers.get("content-type") || "audio/mpeg";

            // Save to IndexedDB audio store
            await musicIndexedDbHelper.saveSongAudio(song.id, {
              fileData: buf,
              mimeType,
            });

            // Add processed song without the audio data
            processedSongs.push({
              ...song,
              hasStoredAudio: true,
              albumArt: song.albumArt, // Preserve album art when processing
            });

            processedCount++;
            // Update toast with progress
            toast.loading(
              `Processing ${processedCount}/${totalSongs} songs...`,
              {
                id: toastId,
                description: `Current: ${song.title}`,
              }
            );
          } catch (error) {
            const err = error as Error;
            console.error(
              `Failed to process audio for song: ${song.title}`,
              err
            );
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

      // Show completion toast
      toast.success(`Processed ${processedCount} songs`, {
        id: toastId,
      });

      return processedSongs;
    },
    []
  );

  const addSong = useCallback(
    async (song: Song) => {
      // First, update library synchronously
      setLibrary((prev) => {
        const newSongs = [...prev.songs, song];
        const allSongsPlaylistExists = prev.playlists.some(
          (p) => p.id === "all-songs"
        );

        let newPlaylists = prev.playlists.map((p) =>
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

      // Then, process its audio in the background
      try {
        const [processedSong] = await processAudioBatch([song]);
        // Update the song with the processed version
        setLibrary((prev) => {
          const newSongs = prev.songs.map((s) =>
            s.id === processedSong.id ? processedSong : s
          );
          return {
            ...prev,
            songs: newSongs,
            playlists: prev.playlists.map((p) =>
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
    },
    [processAudioBatch, prepareSongsForPlaylist]
  );

  const removeSong = useCallback(
    async (songId: string) => {
      // First, update library synchronously
      setLibrary((prev) => {
        const newSongs = prev.songs.filter((s) => s.id !== songId);
        const newPlaylists = prev.playlists.map((p) => ({
          ...p,
          songs: p.songs.filter((s) => s.id !== songId),
        }));
        return {
          ...prev,
          songs: newSongs,
          playlists: newPlaylists,
          favorites: prev.favorites.filter((id) => id !== songId),
        };
      });

      // Then, remove the audio data from IndexedDB asynchronously
      try {
        await musicIndexedDbHelper.removeSongAudio(songId);
      } catch (error) {
        console.error("Failed to remove song audio from IndexedDB:", error);
      }
    },
    []
  );

  const createPlaylist = useCallback(
    (name: string, songs: Song[] = []) => {
      const newPlaylist: Playlist = {
        id: Date.now().toString(),
        name,
        songs: prepareSongsForPlaylist(songs),
      };
      setLibrary((prev) => ({
        ...prev,
        playlists: [...prev.playlists, newPlaylist],
      }));
      return newPlaylist;
    },
    [prepareSongsForPlaylist]
  );

  const removePlaylist = useCallback((playlistId: string) => {
    setLibrary((prev) => ({
      ...prev,
      playlists: prev.playlists.filter((p) => p.id !== playlistId),
    }));
  }, []);

  const addToFavorites = useCallback((songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(songId)
        ? prev.favorites
        : [...prev.favorites, songId],
    }));
  }, []);

  const removeFromFavorites = useCallback((songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      favorites: prev.favorites.filter((id) => id !== songId),
    }));
  }, []);

  const addToPlaylist = useCallback((playlistId: string, songId: string) => {
    setLibrary((prev) => {
      // Find the song and playlist
      const song = prev.songs.find((s) => s.id === songId);
      if (!song) return prev;

      return {
        ...prev,
        playlists: prev.playlists.map((p) => {
          if (p.id === playlistId) {
            // Don't add if song is already in playlist
            if (p.songs.some((s) => s.id === songId)) return p;
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

  const toggleFavorite = useCallback(
    (songId: string) => {
      const isFav = library.favorites.includes(songId);
      if (isFav) removeFromFavorites(songId);
      else addToFavorites(songId);
      return !isFav;
    },
    [library.favorites, addToFavorites, removeFromFavorites]
  );

  const isFavorited = useCallback(
    (songId: string) => {
      return library.favorites.includes(songId);
    },
    [library.favorites]
  );

  const getFavoriteSongs = useCallback(() => {
    return library.songs.filter((s) => library.favorites.includes(s.id));
  }, [library]);

  const searchSongs = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) return library.songs;
      return library.songs.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.artist.toLowerCase().includes(query.toLowerCase())
      );
    },
    [library.songs]
  );

  const getSearchResults = useCallback(() => {
    return searchSongs(searchQuery);
  }, [searchSongs, searchQuery]);

  const navigateToArtist = useCallback((artist: string) => {
    setPlayerState((prev) => ({
      ...prev,
      view: "artist",
      currentArtist: artist,
    }));
  }, []);

  const navigateToAlbum = useCallback((album: string) => {
    setPlayerState((prev) => ({
      ...prev,
      view: "album",
      currentAlbum: album,
    }));
  }, []);

  const navigateToSongs = useCallback(() => {
    setPlayerState((prev) => ({
      ...prev,
      view: "songs",
      currentArtist: undefined,
      currentAlbum: undefined,
    }));
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = getValidTempo(settings.tempo);
    }
  }, [settings.tempo]);

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
