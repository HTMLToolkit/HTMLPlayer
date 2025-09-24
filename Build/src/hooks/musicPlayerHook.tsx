import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { toggleMiniplayer } from "../components/Miniplayer";
import { CrossfadeManager, AudioSource } from "../helpers/crossfadeHelper";
import DiscordService from "../helpers/discordService";
import { getValidTempo } from "../helpers/musicPlayerUtils";
import { createCacheManager } from "../helpers/cacheManager";
import {
  getSmartShuffledSong,
  createNextSongManager,
} from "../helpers/shuffleManager";
import { createCrossfadeManager } from "../helpers/crossfadeUtils";
import { createAudioProcessor } from "../helpers/audioProcessor";
import { createPlaylistManager } from "../helpers/playlistManager";
import { debounce } from "lodash";

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


  // Create refs for settings and state
  const playHistoryRef = useRef<
    Map<string, { lastPlayed: number; playCount: number }>
  >(new Map());
  const settingsRef = useRef(settings);
  const playerStateRef = useRef(playerState);

  // Create debounced save functions
  const debouncedSaveLibrary = useCallback(
    debounce(async (library: MusicLibrary) => {
      try {
        await musicIndexedDbHelper.saveLibrary(library);
        console.log("Saved musicLibrary to IndexedDB");
      } catch (error) {
        console.error("Failed to persist library data:", error);
      }
    }, 500),
    []
  );

  const debouncedSaveSettings = useCallback(
    debounce(
      async (
        settings: PlayerSettings,
        playHistory: Map<string, { lastPlayed: number; playCount: number }>
      ) => {
        try {
          // Convert play history to serializable format
          const playHistoryArray = Array.from(playHistory.entries());
          const settingsWithPlayHistory = {
            ...settings,
            playHistory: playHistoryArray,
          };
          await musicIndexedDbHelper.saveSettings(settingsWithPlayHistory);
          console.log("Saved playerSettings to IndexedDB");
        } catch (error) {
          console.error("Failed to persist settings:", error);
        }
      },
      300
    ),
    []
  );

  // Initialize the managers
  const cacheManager = createCacheManager(songCacheRef);
  const nextSongManager = createNextSongManager(
    nextSongCacheRef,
    nextSongCacheValidRef
  );
  const crossfadeManager = createCrossfadeManager(
    audioRef,
    nextAudioRef,
    crossfadeManagerRef,
    currentAudioSourceRef,
    nextAudioSourceRef
  );
  const audioProcessor = createAudioProcessor();
  const playlistManager = createPlaylistManager(
    setLibrary,
    library,
    setSearchQuery,
    searchQuery,
    setPlayerState
  );

  // Extract manager functions
  const {
    cacheSong,
    getCachedSong,
    prepareSongsForPlaylist,
    updateSongCache,
    clearAllCache,
  } = cacheManager;

  const { getAndCacheNextSong, invalidateNextSongCache, updatePlayHistory } =
    nextSongManager;

  const {
    setupCrossfadeManager,
    getNextSongForCrossfade,
    prepareNextSongForCrossfade,
    preloadNextSong,
    startCrossfadeTransition,
    cleanupCrossfadeManager,
  } = crossfadeManager;

  const { processAudioBatch } = audioProcessor;

  const {
    createPlaylist,
    removePlaylist,
    addToFavorites,
    removeFromFavorites,
    addToPlaylist,
    toggleFavorite,
    isFavorited,
    getFavoriteSongs,
    searchSongs,
    getSearchResults,
    navigateToArtist,
    navigateToAlbum,
    navigateToSongs,
    exportPlaylist,
    importPlaylist,
  } = playlistManager;

  const setupAudioContext = useCallback(() => {
    if (!audioContextRef.current && audioRef.current) {
      const context = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;

      audioContextRef.current = context;
      
      // Setup crossfade manager with the new audio context
      setupCrossfadeManager(context);

      // Connect analyzer to the crossfade manager's master gain
      if (currentAudioSourceRef.current) {
        currentAudioSourceRef.current.sourceNode.connect(analyser);
      }

      setPlayerState((prev) => ({ ...prev, analyserNode: analyser }));
    }
  }, [setupCrossfadeManager]);

  // Cleanup cache on unmount
  useEffect(() => {
    return () => {
      cleanupCrossfadeManager();

      // Clear any crossfade timeout
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
      }

      clearAllCache();
    };
  }, [cleanupCrossfadeManager, clearAllCache]);

  // Initialize data loading
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
            playlists: validLibrary.playlists.some(
              (p: any) => p.id === "all-songs"
            )
              ? validLibrary.playlists.map((p: any) =>
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
                  (s: Song) => s.id === persistedSettings.lastPlayedSongId
                ) || null;
            }
            if (persistedSettings?.lastPlayedPlaylistId) {
              playlistToSet =
                updatedLibrary.playlists.find(
                  (p: Playlist) =>
                    p.id === persistedSettings.lastPlayedPlaylistId
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
          if (persistedSettings) {
            setSettings(persistedSettings);

            // Restore play history if available
            if (persistedSettings.playHistory) {
              playHistoryRef.current = new Map(persistedSettings.playHistory);
              console.log(
                "Restored play history with",
                persistedSettings.playHistory.length,
                "entries"
              );
            }
          }
        }
      } catch (error) {
        console.error("Failed to load persisted data:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    loadPersistedData();
  }, [prepareSongsForPlaylist]);

  // Save data when changed
  useEffect(() => {
    if (!isInitialized) return;
    debouncedSaveLibrary(library);
  }, [library, isInitialized, debouncedSaveLibrary]);

  useEffect(() => {
    if (!isInitialized) return;
    debouncedSaveSettings(settings, playHistoryRef.current);
  }, [settings, isInitialized, debouncedSaveSettings]);

  // Update refs when state changes - only invalidate cache when truly necessary
  useEffect(() => {
    const previousSettings = settingsRef.current;
    settingsRef.current = settings;

    // Only invalidate if smart shuffle setting changed
    if (previousSettings.smartShuffle !== settings.smartShuffle) {
      console.log("Smart shuffle setting changed, invalidating cache");
      invalidateNextSongCache(true); // Force invalidation
    }
  }, [settings.smartShuffle, invalidateNextSongCache]);

  useEffect(() => {
    const previousState = playerStateRef.current;
    playerStateRef.current = playerState;

    // Only invalidate cache if playlist changed or shuffle/repeat mode changed significantly
    const shouldInvalidate =
      previousState.currentPlaylist?.id !== playerState.currentPlaylist?.id ||
      (previousState.shuffle !== playerState.shuffle && playerState.shuffle) ||
      previousState.repeat !== playerState.repeat;

    if (shouldInvalidate) {
      console.log("Player state changed significantly, invalidating cache");
      invalidateNextSongCache(true);
    }
  }, [
    playerState.currentPlaylist?.id,
    playerState.shuffle,
    playerState.repeat,
    invalidateNextSongCache,
  ]);

  // Update playlist when library changes
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

  // Update audio volume when settings change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  // Update player state when settings change
  useEffect(() => {
    setPlayerState((prev) => ({
      ...prev,
      volume: settings.volume,
      shuffle: settings.defaultShuffle,
      repeat: settings.defaultRepeat,
    }));
  }, [settings.volume, settings.defaultShuffle, settings.defaultRepeat]);

  // Media session and last played updates
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

  // Update tempo when settings change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = getValidTempo(settings.tempo);
    }
  }, [settings.tempo]);

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

      // Track this song in play history (only if this isn't the first song in a new session)
      if (
        playerStateRef.current.currentSong &&
        playerStateRef.current.currentSong.id !== song.id
      ) {
        updatePlayHistory(playHistoryRef, playerStateRef.current.currentSong.id);
      }

      if (audioRef.current) {
        // Cancel any ongoing crossfade and clear timeouts
        if (crossfadeManagerRef.current?.isCrossfading()) {
          crossfadeManagerRef.current.cancelCrossfade();
        }
        if (crossfadeTimeoutRef.current) {
          clearTimeout(crossfadeTimeoutRef.current);
          crossfadeTimeoutRef.current = null;
        }

        // Use the cached URL instead of the original URL
        audioRef.current.src = cachedSong.url;

        // Apply persisted tempo immediately
        audioRef.current.playbackRate = getValidTempo(
          settingsRef.current.tempo
        );

        // Set up crossfade manager if not already done
        if (!audioContextRef.current) setupAudioContext();
        if (audioContextRef.current && !crossfadeManagerRef.current) {
          setupCrossfadeManager(audioContextRef.current);
        }
        if (crossfadeManagerRef.current) {
          if (!currentAudioSourceRef.current) {
            currentAudioSourceRef.current =
              crossfadeManagerRef.current.createAudioSource(audioRef.current);
          }
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
          updateSongCache(
            song,
            playlist,
            playerStateRef,
            settingsRef,
            playHistoryRef,
            getSmartShuffledSong
          );
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
      invalidateNextSongCache,
    ]
  );

  // Audio event handling setup
  useEffect(() => {
    // Initialize primary audio element
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.controls = true; // Enable browser controls

    // Initialize secondary audio element for crossfading
    nextAudioRef.current = new Audio();
    nextAudioRef.current.crossOrigin = "anonymous";
    nextAudioRef.current.controls = true;

    // Set up audio context and crossfade manager early
    if (!audioContextRef.current) {
      try {
        const context = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        audioContextRef.current = context;
        setupCrossfadeManager(context);
      } catch (error) {
        console.warn("Failed to initialize audio context early:", error);
      }
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;

      setPlayerState((prev) => ({
        ...prev,
        currentTime: currentAudio.currentTime,
      }));

      // Handle crossfade timing
      const crossfadeEnabled = settingsRef.current.crossfade > 0;
      const autoPlayNext = settingsRef.current.autoPlayNext;
      const playNextAvailable = !!playNextRef.current;
      const notRepeatOne = playerStateRef.current.repeat !== "one";
      const hasDuration = currentAudio.duration > 0;
      const notCrossfading = !crossfadeManagerRef.current?.isCrossfading();

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
        const preloadTime = Math.max(crossfadeDuration + 2, 5);

        // Preload next song early
        if (timeRemaining <= preloadTime && timeRemaining > preloadTime - 0.5) {
          preloadNextSong(
            () =>
              getNextSongForCrossfade(() =>
                getAndCacheNextSong(
                  playerStateRef,
                  settingsRef,
                  playHistoryRef
                )
              ),
            cacheSong,
            getCachedSong,
            settingsRef
          );
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
          startCrossfadeTransition(
            playNextRef,
            () =>
              getAndCacheNextSong(
                playerStateRef,
                settingsRef,
                playHistoryRef
              ),
            (nextSong: Song) =>
              prepareNextSongForCrossfade(
                nextSong,
                cacheSong,
                getCachedSong,
                settingsRef
              ),
            playerStateRef,
            playHistoryRef,
            updatePlayHistory,
            setPlayerState,
            settingsRef,
            audioContextRef
          ).catch((error) => {
            console.error("Crossfade transition failed:", error);
          });
        }
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

    const handleEnded = (event: Event) => {
      const target = event.target as HTMLAudioElement;
      if (target !== audioRef.current) {
        return;
      }

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
              
              // Clear any existing crossfade timeout to prevent conflicts
              if (crossfadeTimeoutRef.current) {
                clearTimeout(crossfadeTimeoutRef.current);
                crossfadeTimeoutRef.current = null;
              }

              // Start immediate crossfade with proper error handling
              startCrossfadeTransition(
                playNextRef,
                () =>
                  getAndCacheNextSong(
                    playerStateRef,
                    settingsRef,
                    playHistoryRef
                  ),
                (nextSong: Song) =>
                  prepareNextSongForCrossfade(
                    nextSong,
                    cacheSong,
                    getCachedSong,
                    settingsRef
                  ),
                playerStateRef,
                playHistoryRef,
                updatePlayHistory,
                setPlayerState,
                settingsRef,
                audioContextRef
              ).catch((error) => {
                console.error("Immediate crossfade failed:", error);
                // Fallback to regular playNext if crossfade fails
                if (playNextRef.current) {
                  console.log("Falling back to regular playNext");
                  playNextRef.current();
                }
              });
            }
          }
        }
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
    let nextSong = getAndCacheNextSong(
      playerStateRef,
      settingsRef,
      playHistoryRef
    );

    if (nextSong) {
      // Update play history (for non-crossfade transitions)
      if (
        playerState.shuffle &&
        !crossfadeManagerRef.current?.isCrossfading()
      ) {
        updatePlayHistory(playHistoryRef, playerState.currentSong!.id);
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
    updatePlayHistory,
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
            playHistoryRef.current
          );
          nextSong =
            smartSong ||
            available[Math.floor(Math.random() * available.length)];
        } else {
          // Use regular shuffle
          const randomIndex = Math.floor(Math.random() * available.length);
          nextSong = available[randomIndex];
        }

        // Update play history
        updatePlayHistory(playHistoryRef, playerState.currentSong!.id);

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
    updatePlayHistory,
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
