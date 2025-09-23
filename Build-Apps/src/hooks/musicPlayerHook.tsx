import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { toggleMiniplayer } from "../components/Miniplayer";
import { CrossfadeManager, AudioSource } from "../helpers/crossfadeHelper";
import DiscordService from "../helpers/discordService";

// Debouncing utility for IndexedDB saves
const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: number;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
};
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
  gaplessPlayback: boolean;
  smartShuffle: boolean;
  discordUserId?: string;
  discordEnabled: boolean;
  recentlyPlayed?: string[];
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

  // Cache the next song decision to ensure crossfade and playNext use the same song
  const nextSongCacheRef = useRef<Song | null>(null);
  const nextSongCacheValidRef = useRef<boolean>(false);

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
    gaplessPlayback: true,
    smartShuffle: true,
    discordEnabled: false,
    discordUserId: undefined,
  });

  const [library, setLibrary] = useState<MusicLibrary>(() => ({
    songs: [],
    playlists: [],
    favorites: [],
  }));

  const [searchQuery, setSearchQuery] = useState("");

  // Track recently played songs for smart shuffle
  const [recentlyPlayed, setRecentlyPlayed] = useState<string[]>([]);

  // Create debounced save functions to prevent excessive IndexedDB writes
  const debouncedSaveLibrary = useCallback(
    debounce(async (library: MusicLibrary) => {
      try {
        await musicIndexedDbHelper.saveLibrary(library);
        console.log("Saved musicLibrary to IndexedDB");
      } catch (error) {
        console.error("Failed to persist library data:", error);
      }
    }, 500), // 500ms delay
    []
  );

  const debouncedSaveSettings = useCallback(
    debounce(async (settings: PlayerSettings, recentlyPlayed: string[]) => {
      try {
        const settingsWithRecentlyPlayed = {
          ...settings,
          recentlyPlayed: recentlyPlayed,
        };
        await musicIndexedDbHelper.saveSettings(settingsWithRecentlyPlayed);
        console.log("Saved playerSettings to IndexedDB");
      } catch (error) {
        console.error("Failed to persist settings:", error);
      }
    }, 300), // 300ms delay
    []
  );

  const settingsRef = useRef(settings);
  const playerStateRef = useRef(playerState);
  const libraryRef = useRef(library);
  const recentlyPlayedRef = useRef<string[]>([]);

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

  // Smart shuffle algorithm that avoids recently played songs
  const getSmartShuffledSong = useCallback(
    (
      availableSongs: Song[],
      currentSongId: string,
      recentlyPlayedIds: string[]
    ): Song | null => {
      if (availableSongs.length === 0) return null;

      // Filter out the current song and recently played songs
      const filteredSongs = availableSongs.filter(
        (song) =>
          song.id !== currentSongId && !recentlyPlayedIds.includes(song.id)
      );

      // If we've filtered out too many songs, fall back to avoiding only the last few
      const songsToChooseFrom =
        filteredSongs.length > 0
          ? filteredSongs
          : availableSongs.filter(
              (song) =>
                song.id !== currentSongId &&
                !recentlyPlayedIds
                  .slice(-Math.min(3, recentlyPlayedIds.length))
                  .includes(song.id)
            );

      // If still no songs available, just exclude current song
      const finalSongs =
        songsToChooseFrom.length > 0
          ? songsToChooseFrom
          : availableSongs.filter((song) => song.id !== currentSongId);

      if (finalSongs.length === 0) return null;

      // Weighted random selection - prefer songs that haven't been played recently
      const weights = finalSongs.map((song) => {
        const timesInRecent = recentlyPlayedIds.filter(
          (id) => id === song.id
        ).length;
        return Math.max(1, 10 - timesInRecent * 3); // Higher weight for less recently played
      });

      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let randomWeight = Math.random() * totalWeight;

      for (let i = 0; i < finalSongs.length; i++) {
        randomWeight -= weights[i];
        if (randomWeight <= 0) {
          return finalSongs[i];
        }
      }

      // Fallback to the last song
      return finalSongs[finalSongs.length - 1];
    },
    []
  );

  // Function to determine and cache the next song to ensure consistency between crossfade and playNext
  const getAndCacheNextSong = useCallback(
    (currentRecentlyPlayed?: string[]): Song | null => {
      if (
        !playerStateRef.current.currentPlaylist ||
        !playerStateRef.current.currentSong
      ) {
        return null;
      }

      // If we have a valid cached next song, return it
      if (nextSongCacheValidRef.current && nextSongCacheRef.current) {
        console.log("Using cached next song:", nextSongCacheRef.current.title);
        return nextSongCacheRef.current;
      }

      // Use provided recently played list or current state from ref
      const recentlyPlayedToUse =
        currentRecentlyPlayed || recentlyPlayedRef.current;

      console.log(
        "Computing new next song. Current song:",
        playerStateRef.current.currentSong.title
      );
      console.log("Recently played to use:", recentlyPlayedToUse.slice(0, 3));
      console.log("Recently played from state:", recentlyPlayed.slice(0, 3));
      console.log(
        "Recently played from ref:",
        recentlyPlayedRef.current.slice(0, 3)
      );

      const songs = playerStateRef.current.currentPlaylist.songs;
      const currentIndex = songs.findIndex(
        (s) => s.id === playerStateRef.current.currentSong!.id
      );
      let nextSong: Song | null = null;

      if (playerStateRef.current.shuffle) {
        const available = songs.filter(
          (s) => s.id !== playerStateRef.current.currentSong!.id
        );
        if (available.length > 0) {
          if (settingsRef.current.smartShuffle) {
            // Use smart shuffle algorithm
            nextSong = getSmartShuffledSong(
              available,
              playerStateRef.current.currentSong!.id,
              recentlyPlayedToUse
            );
            if (!nextSong) {
              nextSong =
                available[Math.floor(Math.random() * available.length)];
            }
            console.log("Smart shuffle selected:", nextSong?.title);
          } else {
            // Use regular shuffle
            const randomIndex = Math.floor(Math.random() * available.length);
            nextSong = available[randomIndex];
            console.log("Regular shuffle selected:", nextSong?.title);
          }
        }
      } else {
        if (currentIndex < songs.length - 1) {
          nextSong = songs[currentIndex + 1];
        } else if (playerStateRef.current.repeat === "all") {
          nextSong = songs[0];
        }
        console.log("Sequential next song:", nextSong?.title);
      }

      // Cache the result
      nextSongCacheRef.current = nextSong;
      nextSongCacheValidRef.current = true;
      console.log("Cached next song:", nextSong?.title);

      return nextSong;
    },
    [getSmartShuffledSong]
  );

  // Function to invalidate the next song cache
  const invalidateNextSongCache = useCallback(() => {
    console.log("Invalidating next song cache");
    nextSongCacheRef.current = null;
    nextSongCacheValidRef.current = false;
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
        if (settingsRef.current.smartShuffle) {
          // Use smart shuffle for caching
          nextShuffledSong = getSmartShuffledSong(
            availableSongs,
            currentSong.id,
            recentlyPlayed
          );
        } else {
          // Use regular shuffle for caching
          const randomIndex = Math.floor(Math.random() * availableSongs.length);
          nextShuffledSong = availableSongs[randomIndex];
        }
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
          if (
            !songToPlay &&
            playlistToSet.songs.length > 0 &&
            persistedSettings?.sessionRestore !== false
          ) {
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

        if (persistedSettings) {
          setSettings(persistedSettings);

          // Restore recently played list if available
          if (persistedSettings.recentlyPlayed) {
            setRecentlyPlayed(persistedSettings.recentlyPlayed);
            console.log(
              "Restored recently played list:",
              persistedSettings.recentlyPlayed.slice(0, 3)
            );
          }
        }
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
    debouncedSaveLibrary(library);
  }, [library, isInitialized, debouncedSaveLibrary]);

  useEffect(() => {
    if (!isInitialized) return;
    debouncedSaveSettings(settings, recentlyPlayed);
  }, [settings, recentlyPlayed, isInitialized, debouncedSaveSettings]);

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
        currentAudioSourceRef.current =
          crossfadeManagerRef.current.createAudioSource(audioRef.current);
        crossfadeManagerRef.current.setCurrentSource(
          currentAudioSourceRef.current
        );
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
    return getAndCacheNextSong();
  };

  const prepareNextSongForCrossfade = async (nextSong: Song) => {
    if (!nextAudioRef.current || !crossfadeManagerRef.current) return;

    // Check if song is already preloaded
    if (
      nextAudioRef.current.src &&
      !nextAudioRef.current.src.includes("about:blank")
    ) {
      // Song is already preloaded, just set up the audio source
      if (!nextAudioSourceRef.current) {
        nextAudioSourceRef.current =
          crossfadeManagerRef.current.createAudioSource(nextAudioRef.current);
      }
      crossfadeManagerRef.current.prepareNextSource(nextAudioSourceRef.current);
      return;
    }

    // Song not preloaded, do full preparation
    await cacheSong(nextSong);
    const cachedSong = getCachedSong(nextSong.id);
    if (!cachedSong) {
      throw new Error("Failed to cache next song for crossfade");
    }

    // Set up the next audio element
    nextAudioRef.current.src = cachedSong.url;
    nextAudioRef.current.playbackRate = getValidTempo(
      settingsRef.current.tempo
    );

    // Create audio source for crossfade manager
    if (!nextAudioSourceRef.current) {
      nextAudioSourceRef.current =
        crossfadeManagerRef.current.createAudioSource(nextAudioRef.current);
    }

    // Prepare for crossfade
    crossfadeManagerRef.current.prepareNextSource(nextAudioSourceRef.current);
  };

  const updatePlayerStateAfterCrossfade = (nextSong: Song) => {
    console.log("updatePlayerStateAfterCrossfade called with:", nextSong.title);
    console.log(
      "Current song before update:",
      playerStateRef.current.currentSong?.title
    );
    console.log(
      "Current recently played before update:",
      recentlyPlayed.slice(0, 3)
    );

    // Update recently played ONLY if we're in shuffle mode and have a current song
    if (playerStateRef.current.currentSong && playerStateRef.current.shuffle) {
      const updatedRecentlyPlayed = [
        playerStateRef.current.currentSong.id,
        ...recentlyPlayed.slice(0, 19),
      ];
      console.log(
        "Updated recently played after crossfade:",
        updatedRecentlyPlayed.slice(0, 3)
      );

      // Update the state
      setRecentlyPlayed(updatedRecentlyPlayed);
    }

    // Swap audio elements - next becomes current
    const tempAudio = audioRef.current;
    audioRef.current = nextAudioRef.current;
    nextAudioRef.current = tempAudio;

    // Swap audio sources
    const tempSource = currentAudioSourceRef.current;
    currentAudioSourceRef.current = nextAudioSourceRef.current;
    nextAudioSourceRef.current = tempSource;

    // Update player state
    setPlayerState((prev) => ({
      ...prev,
      currentSong: nextSong,
      currentTime: 0,
      isPlaying: true,
    }));

    // Only invalidate next song cache if we're actually in shuffle mode or smart shuffle is enabled
    // The cache invalidation will be handled by the useEffect hooks that watch for state changes
    // No need to invalidate here since the state change will trigger it automatically
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

      // Handle crossfade timing - crossfade can work independently of gapless setting
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
        if (
          timeRemaining <= crossfadeDuration &&
          timeRemaining > crossfadeDuration - 0.5
        ) {
          console.log(
            "Triggering crossfade at",
            timeRemaining.toFixed(1),
            "seconds remaining"
          );
          startCrossfadeTransition();
        }
      }
    };

    const preloadNextSong = async () => {
      if (
        !nextAudioRef.current ||
        crossfadeManagerRef.current?.isCrossfading()
      ) {
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
          nextAudioRef.current.playbackRate = getValidTempo(
            settingsRef.current.tempo
          );
          console.log("Preloaded next song for crossfade:", nextSong.title);
        }
      } catch (error) {
        console.warn("Failed to preload next song:", error);
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
          // Handle different transition modes based on settings
          if (settingsRef.current.crossfade === 0) {
            // No crossfade - use gapless or with delay
            if (settingsRef.current.gaplessPlayback) {
              playNextRef.current();
            } else {
              setTimeout(() => playNextRef.current?.(), 400);
            }
          } else {
            // Crossfade is enabled - check if transition already happened or needs to happen now
            if (crossfadeManagerRef.current?.isCrossfading()) {
              // Crossfade is already in progress, let it complete naturally
              console.log("Crossfade transition already in progress");
            } else {
              // Crossfade didn't start in time (maybe song too short), do immediate transition
              console.log(
                "Starting immediate crossfade transition on song end"
              );
              startCrossfadeTransition();
            }
          }
        }
      }
    };

    const startCrossfadeTransition = async () => {
      if (
        !playNextRef.current ||
        !crossfadeManagerRef.current ||
        !nextAudioRef.current
      ) {
        return;
      }

      try {
        // Get the next song info (this is a bit tricky since we need to predict what playNext will play)
        const nextSong = getNextSongForCrossfade();
        if (!nextSong) {
          console.warn("No next song found for crossfade");
          return;
        }

        // Prepare the next audio source
        await prepareNextSongForCrossfade(nextSong);

        // Start the crossfade
        await crossfadeManagerRef.current.startCrossfade({
          duration: settingsRef.current.crossfade,
          curve: "exponential",
        });

        // Update current song state after crossfade completes
        console.log("Crossfade completed, updating state");
        updatePlayerStateAfterCrossfade(nextSong);
      } catch (error) {
        console.error("Crossfade failed:", error);
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
    const previousSettings = settingsRef.current;
    settingsRef.current = settings;

    // Only invalidate next song cache if shuffle-related settings that actually affect next song selection changed
    if (
      previousSettings.smartShuffle !== settings.smartShuffle ||
      (playerState.shuffle &&
        previousSettings.smartShuffle !== settings.smartShuffle)
    ) {
      console.log(
        "Smart shuffle setting changed, invalidating next song cache"
      );
      invalidateNextSongCache();
    }
  }, [settings.smartShuffle, playerState.shuffle, invalidateNextSongCache]);

  useEffect(() => {
    const previousState = playerStateRef.current;
    playerStateRef.current = playerState;

    // Only invalidate next song cache if specific properties that affect next song selection changed
    if (
      previousState.shuffle !== playerState.shuffle ||
      previousState.currentPlaylist?.id !== playerState.currentPlaylist?.id ||
      previousState.repeat !== playerState.repeat
    ) {
      console.log(
        "Player state affecting next song changed, invalidating cache"
      );
      invalidateNextSongCache();
    }
  }, [
    playerState.shuffle,
    playerState.currentPlaylist?.id,
    playerState.repeat,
    invalidateNextSongCache,
  ]);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  useEffect(() => {
    recentlyPlayedRef.current = recentlyPlayed;

    // Only invalidate next song cache when recently played changes AND smart shuffle is enabled AND we're in shuffle mode
    // Also check if there was actually a meaningful change to avoid unnecessary invalidations
    if (
      settingsRef.current.smartShuffle &&
      playerStateRef.current.shuffle &&
      recentlyPlayed.length > 0
    ) {
      invalidateNextSongCache();
    }
  }, [recentlyPlayed, invalidateNextSongCache]);

  useEffect(() => {
    if (playerState.currentPlaylist) {
      const updatedPlaylist = library.playlists.find(
        (p) => p.id === playerState.currentPlaylist?.id
      );
      if (
        updatedPlaylist &&
        updatedPlaylist.songs !== playerState.currentPlaylist.songs
      ) {
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

      navigator.mediaSession.setActionHandler(
        "enterpictureinpicture" as any,
        () => {
          toggleMiniplayer({
            playerState: {
              currentSong: playerState.currentSong,
              isPlaying: playerState.isPlaying,
            },
            togglePlayPause,
            playNext,
            playPrevious,
          });
        }
      );

      return () => {
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
          navigator.mediaSession.setActionHandler(
            "enterpictureinpicture" as any,
            null
          );
        }
      };
    }
  }, [playerState.currentSong, playerState.currentPlaylist, isInitialized]);

  // Discord presence update function
  const updateDiscordPresence = useCallback(
    async (song: Song | null, isPlaying: boolean) => {
      const discordService = DiscordService.getInstance();

      if (!settings.discordEnabled || !settings.discordUserId) {
        return;
      }

      try {
        if (song && isPlaying) {
          await discordService.updatePresence({
            userId: settings.discordUserId,
            details: song.title,
            state: song.artist,
          });
        } else {
          // Clear presence when not playing or no song
          await discordService.clearPresence(settings.discordUserId);
        }
      } catch (error) {
        console.error("Failed to update Discord presence:", error);
      }
    },
    [settings.discordEnabled, settings.discordUserId]
  );

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

      // Track this song in recently played list (only if this isn't the first song in a new session)
      if (
        playerStateRef.current.currentSong &&
        playerStateRef.current.currentSong.id !== song.id
      ) {
        setRecentlyPlayed((prev) => {
          const updated = [
            playerStateRef.current.currentSong!.id,
            ...prev.slice(0, 19),
          ]; // Keep last 20 songs
          return updated;
        });
      }

      if (audioRef.current) {
        // Cancel any ongoing crossfade
        if (crossfadeManagerRef.current?.isCrossfading()) {
          crossfadeManagerRef.current.cancelCrossfade();
        }

        // Use the cached URL instead of the original URL
        audioRef.current.src = cachedSong.url;

        // Apply persisted tempo immediately
        audioRef.current.playbackRate = getValidTempo(
          settingsRef.current.tempo
        );

        // Set up crossfade manager if not already done
        if (!audioContextRef.current) setupAudioContext();
        if (crossfadeManagerRef.current && !currentAudioSourceRef.current) {
          currentAudioSourceRef.current =
            crossfadeManagerRef.current.createAudioSource(audioRef.current);
          crossfadeManagerRef.current.setCurrentSource(
            currentAudioSourceRef.current
          );
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

                setPlayerState((prev) => ({
                  ...prev,
                  currentSong: updatedSong,
                }));
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

        // Update Discord presence when song starts playing
        updateDiscordPresence(song, true);

        // Invalidate next song cache since current song changed
        invalidateNextSongCache();
      }
    },
    [
      setupAudioContext,
      cacheSong,
      getCachedSong,
      updateSongCache,
      prepareSongsForPlaylist,
      updateDiscordPresence,
      setRecentlyPlayed,
      invalidateNextSongCache,
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
      // Update Discord presence when paused
      updateDiscordPresence(playerState.currentSong, false);
    } else {
      // Check if audio source is loaded
      if (
        !audioRef.current.src ||
        audioRef.current.src.includes("about:blank")
      ) {
        // Audio source not loaded, need to load the song first
        await playSong(
          playerState.currentSong,
          playerState.currentPlaylist || undefined
        );
        return; // playSong will set isPlaying to true
      }

      audioRef.current
        .play()
        .catch(() => setPlayerState((prev) => ({ ...prev, isPlaying: false })));
      setPlayerState((prev) => ({ ...prev, isPlaying: true }));
      // Update Discord presence when playing
      updateDiscordPresence(playerState.currentSong, true);
    }
  }, [
    playerState.isPlaying,
    playerState.currentSong,
    playerState.currentPlaylist,
    playSong,
    updateDiscordPresence,
  ]);

  const playNext = useCallback(() => {
    if (!playerState.currentPlaylist || !playerState.currentSong) return;

    // Cancel any ongoing crossfade when user manually skips
    if (crossfadeManagerRef.current?.isCrossfading()) {
      crossfadeManagerRef.current.cancelCrossfade();
    }

    // Use the cached next song if available, otherwise determine it
    let nextSong = getAndCacheNextSong();

    if (nextSong) {
      // Update recently played list (for non-crossfade transitions)
      if (
        playerState.shuffle &&
        !crossfadeManagerRef.current?.isCrossfading()
      ) {
        setRecentlyPlayed((prev) => {
          const updated = [playerState.currentSong!.id, ...prev.slice(0, 19)]; // Keep last 20 songs
          return updated;
        });
      }

      // Invalidate the cache since we're consuming the cached song
      invalidateNextSongCache();

      playSong(nextSong, playerState.currentPlaylist);
    }
  }, [
    playerState,
    playSong,
    getAndCacheNextSong,
    invalidateNextSongCache,
    setRecentlyPlayed,
  ]);

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
        let nextSong: Song;

        if (settings.smartShuffle) {
          // Use smart shuffle
          const smartSong = getSmartShuffledSong(
            available,
            playerState.currentSong!.id,
            recentlyPlayed
          );
          nextSong =
            smartSong ||
            available[Math.floor(Math.random() * available.length)];
        } else {
          // Use regular shuffle
          const randomIndex = Math.floor(Math.random() * available.length);
          nextSong = available[randomIndex];
        }

        // Update recently played list
        setRecentlyPlayed((prev) => {
          const updated = [playerState.currentSong!.id, ...prev.slice(0, 19)]; // Keep last 20 songs
          return updated;
        });

        playSong(nextSong, playerState.currentPlaylist);
      }
    } else {
      if (currentIndex > 0) {
        playSong(songs[currentIndex - 1], playerState.currentPlaylist);
      } else if (playerState.repeat === "all") {
        playSong(songs[songs.length - 1], playerState.currentPlaylist);
      }
    }
  }, [
    playerState,
    playSong,
    settings.smartShuffle,
    recentlyPlayed,
    getSmartShuffledSong,
    setRecentlyPlayed,
  ]);

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

  const removeSong = useCallback(async (songId: string) => {
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
  }, []);

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

  // Export playlist to JSON or M3U format
  const exportPlaylist = useCallback(
    (playlist: Playlist, format: "json" | "m3u" = "json") => {
      try {
        let content: string;
        let filename: string;
        let mimeType: string;

        if (format === "json") {
          // Export as JSON with full metadata
          const exportData = {
            name: playlist.name,
            created: new Date().toISOString(),
            songs: playlist.songs.map((song) => ({
              title: song.title,
              artist: song.artist,
              album: song.album,
              duration: song.duration,
              // Don't include URL or file data for privacy/size reasons
            })),
          };
          content = JSON.stringify(exportData, null, 2);
          filename = `${playlist.name.replace(/[^a-z0-9]/gi, "_")}.json`;
          mimeType = "application/json";
        } else {
          // Export as M3U playlist
          content = "#EXTM3U\n";
          playlist.songs.forEach((song) => {
            content += `#EXTINF:${Math.floor(song.duration)},${song.artist} - ${
              song.title
            }\n`;
            content += `# ${song.album}\n`;
          });
          filename = `${playlist.name.replace(/[^a-z0-9]/gi, "_")}.m3u`;
          mimeType = "audio/x-mpegurl";
        }

        // Create and download file
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(
          `Exported playlist "${playlist.name}" as ${format.toUpperCase()}`
        );
      } catch (error) {
        console.error("Export failed:", error);
        toast.error(
          `Failed to export playlist: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
    []
  );

  // Import playlist from JSON file
  const importPlaylist = useCallback(
    (file: File) => {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;

            if (file.name.endsWith(".json")) {
              // Parse JSON playlist
              const playlistData = JSON.parse(content);

              if (!playlistData.name || !Array.isArray(playlistData.songs)) {
                throw new Error("Invalid playlist format");
              }

              // Create new playlist with imported metadata (songs will need to be matched/re-added)
              const newPlaylist: Playlist = {
                id: Date.now().toString(),
                name: `${playlistData.name} (Imported)`,
                songs: [], // Empty for now, user will need to add songs manually
              };

              // Add the playlist
              createPlaylist(newPlaylist.name, newPlaylist.songs);

              toast.success(
                `Imported playlist "${playlistData.name}" with ${playlistData.songs.length} song references`
              );
              toast.info(
                "Note: You'll need to add songs to this playlist manually as audio files cannot be imported."
              );
              resolve();
            } else if (
              file.name.endsWith(".m3u") ||
              file.name.endsWith(".m3u8")
            ) {
              // Parse M3U playlist
              const lines = content.split("\n").filter((line) => line.trim());
              const songs: Array<{ title: string; artist: string }> = [];

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith("#EXTINF:")) {
                  // Extract artist and title from M3U format
                  const match = line.match(/#EXTINF:\d+,(.+?) - (.+)/);
                  if (match) {
                    songs.push({
                      artist: match[1],
                      title: match[2],
                    });
                  }
                }
              }

              // Create playlist
              const playlistName = file.name.replace(/\.(m3u|m3u8)$/i, "");
              createPlaylist(`${playlistName} (Imported)`, []);

              toast.success(
                `Imported M3U playlist with ${songs.length} song references`
              );
              toast.info(
                "Note: You'll need to add songs to this playlist manually as audio files cannot be imported."
              );
              resolve();
            } else {
              throw new Error(
                "Unsupported file format. Please use .json, .m3u, or .m3u8 files."
              );
            }
          } catch (error) {
            console.error("Import failed:", error);
            const message =
              error instanceof Error
                ? error.message
                : "Failed to parse playlist file";
            toast.error(`Import failed: ${message}`);
            reject(error);
          }
        };

        reader.onerror = () => {
          const error = new Error("Failed to read file");
          toast.error("Failed to read file");
          reject(error);
        };

        reader.readAsText(file);
      });
    },
    [createPlaylist]
  );

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
    exportPlaylist,
    importPlaylist,
  };
};
