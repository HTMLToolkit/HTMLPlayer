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
  const preloadTimeoutRef = useRef<number | null>(null);

  // Cache the next song decision to ensure crossfade and playNext use the same song
  const nextSongCacheRef = useRef<Song | null>(null);
  const nextSongCacheValidRef = useRef<boolean>(false);
  const isPreloadingRef = useRef<boolean>(false);

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

      // Connect analyzer between master gain and destination
      if (crossfadeManagerRef.current) {
        crossfadeManagerRef.current.getMasterGainNode().connect(analyser);
        analyser.connect(context.destination);
      } else {
        // Fallback: connect directly
        analyser.connect(context.destination);
      }

      setPlayerState((prev) => ({ ...prev, analyserNode: analyser }));
    }
  }, [setupCrossfadeManager]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      cleanupCrossfadeManager();

      // Clear any timeouts
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
      }
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }

      clearAllCache();
    };
  }, []); // Only run on unmount

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

  // Update refs when state changes
  useEffect(() => {
    const previousSettings = settingsRef.current;
    settingsRef.current = settings;

    // Only invalidate if smart shuffle setting changed
    if (previousSettings.smartShuffle !== settings.smartShuffle) {
      console.log("Smart shuffle setting changed, invalidating cache");
      invalidateNextSongCache(true);
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
    if (crossfadeManagerRef.current) {
      crossfadeManagerRef.current.setMasterVolume(settings.volume);
    } else if (audioRef.current) {
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
    if (nextAudioRef.current) {
      nextAudioRef.current.playbackRate = getValidTempo(settings.tempo);
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

  // Improved preload function
  const smartPreloadNextSong = useCallback(async () => {
    if (isPreloadingRef.current || !playerState.currentSong || !playerState.currentPlaylist) {
      return;
    }

    // Don't preload if repeat one is enabled
    if (playerState.repeat === "one") {
      return;
    }

    isPreloadingRef.current = true;

    try {
      // Get next song using the same logic as crossfade and playNext
      const nextSong = getAndCacheNextSong(playerStateRef, settingsRef, playHistoryRef);

      if (nextSong) {
        // Cache the next song decision (already done by getAndCacheNextSong, but ensure consistency)
        nextSongCacheRef.current = nextSong;
        nextSongCacheValidRef.current = true;

        // Preload for crossfade if enabled
        if (settings.crossfade > 0 && nextAudioRef.current) {
          await preloadNextSong(
            () => nextSong,
            cacheSong,
            getCachedSong,
            settingsRef
          );
        }
      }
    } catch (error) {
      console.error("Failed to preload next song:", error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [playerState, settings, preloadNextSong, cacheSong, getCachedSong, getAndCacheNextSong]);

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

      // Clear any pending timeouts
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
        crossfadeTimeoutRef.current = null;
      }
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
        preloadTimeoutRef.current = null;
      }

      // Prepare song for playing
      const songToPlay = song.hasStoredAudio
        ? {
          ...song,
          url: `indexeddb://${song.id}`,
        }
        : song;

      // Cache the song
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

      // Track this song in play history
      if (
        playerStateRef.current.currentSong &&
        playerStateRef.current.currentSong.id !== song.id
      ) {
        updatePlayHistory(playHistoryRef, playerStateRef.current.currentSong.id);
      }

      if (audioRef.current) {
        // Cancel any ongoing crossfade
        if (crossfadeManagerRef.current?.isCrossfading()) {
          crossfadeManagerRef.current.cancelCrossfade();
        }

        // Use the cached URL
        audioRef.current.src = cachedSong.url;
        audioRef.current.playbackRate = getValidTempo(settingsRef.current.tempo);

        // Set up crossfade manager if needed
        if (!audioContextRef.current) setupAudioContext();
        if (audioContextRef.current && !crossfadeManagerRef.current) {
          setupCrossfadeManager(audioContextRef.current);
        }
        if (crossfadeManagerRef.current) {
          if (!currentAudioSourceRef.current || currentAudioSourceRef.current.element !== audioRef.current) {
            currentAudioSourceRef.current =
              crossfadeManagerRef.current.createAudioSource(audioRef.current);
          }
          crossfadeManagerRef.current.setCurrentSource(currentAudioSourceRef.current);
        }

        try {
          await audioRef.current.play();
        } catch (error: any) {
          console.error("Failed to play song:", error);
          toast.error(`Failed to play "${song.title}"`, {
            description: error.message || "Unknown error occurred",
          });
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
          return;
        }

        // Update the cache and invalidate next song cache
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

        updateDiscordPresence(song, true);
        invalidateNextSongCache();

        // Smart preload the next song after a short delay
        preloadTimeoutRef.current = window.setTimeout(() => {
          smartPreloadNextSong();
        }, 2000);
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
      smartPreloadNextSong,
    ]
  );

  // Audio event handling setup
  useEffect(() => {
    // Initialize primary audio element
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";

    // Initialize secondary audio element for crossfading
    nextAudioRef.current = new Audio();
    nextAudioRef.current.crossOrigin = "anonymous";

    const audio = audioRef.current;

    const handleTimeUpdate = (event: Event) => {
      const target = event.target as HTMLAudioElement;
      const currentAudio = audioRef.current;
      const nextAudio = nextAudioRef.current;
      
      let shouldUpdateFrom = currentAudio;
      
      // During crossfade, use the next audio element since that's the song becoming current
      // But only if the crossfade is actually in progress and hasn't failed
      if (crossfadeManagerRef.current?.isCrossfading() && nextAudio && nextAudio.src && !nextAudio.src.includes("about:blank")) {
        shouldUpdateFrom = nextAudio;
      }
      
      // Only update if this event is from the element that should control progress
      if (target !== shouldUpdateFrom) return;

      setPlayerState((prev) => {
        return {
          ...prev,
          currentTime: target.currentTime,
        };
      });

      // Handle crossfade and gapless timing
      const crossfadeEnabled = settingsRef.current.crossfade > 0;
      const gaplessEnabled = settingsRef.current.gaplessPlayback;
      const autoPlayNext = settingsRef.current.autoPlayNext;
      const playNextAvailable = !!playNextRef.current;
      const notRepeatOne = playerStateRef.current.repeat !== "one";
      const hasDuration = currentAudio && currentAudio.duration > 0;
      const notCrossfading = !crossfadeManagerRef.current?.isCrossfading();

      if (
        autoPlayNext &&
        playNextAvailable &&
        notRepeatOne &&
        hasDuration &&
        notCrossfading &&
        currentAudio
      ) {
        const timeRemaining = currentAudio.duration - currentAudio.currentTime;

        if (crossfadeEnabled) {
          const crossfadeDuration = settingsRef.current.crossfade;
          const preloadTime = Math.max(crossfadeDuration + 5, 10);

          // Preload next song early
          if (timeRemaining <= preloadTime && timeRemaining > preloadTime - 1) {
            if (!isPreloadingRef.current) {
              smartPreloadNextSong();
            }
          }

          // Start crossfade
          if (timeRemaining <= crossfadeDuration) {
            console.log("Triggering crossfade at", timeRemaining.toFixed(1), "seconds remaining");
            startCrossfadeTransition(
              playNextRef,
              () => nextSongCacheRef.current || getAndCacheNextSong(playerStateRef, settingsRef, playHistoryRef),
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
              audioContextRef,
              invalidateNextSongCache
            ).catch((error: any) => {
              console.error("Crossfade transition failed:", error);
            });
          }
        } else if (gaplessEnabled) {
          // For gapless playback, prepare next song earlier
          if (timeRemaining <= 3 && timeRemaining > 2.5) {
            if (!isPreloadingRef.current) {
              smartPreloadNextSong();
            }
          }
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

      // If crossfade is in progress and current song ends, complete crossfade immediately
      if (crossfadeManagerRef.current?.isCrossfading()) {
        console.log("Current song ended during crossfade, completing immediately");
        // Force complete the crossfade since the current song has ended
        if (crossfadeManagerRef.current) {
          // The completeCrossfade method will handle the state transitions
          // But we need to trigger the player state update that normally happens after startCrossfade resolves
          setTimeout(() => {
            // This should trigger the updatePlayerStateAfterCrossfade logic
            // But since we're in the middle of crossfade, we need to be careful
            console.log("Crossfade interrupted by song end");
          }, 100);
        }
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
              console.log("Starting immediate crossfade transition on song end");

              // Clear any existing crossfade timeout to prevent conflicts
              if (crossfadeTimeoutRef.current) {
                clearTimeout(crossfadeTimeoutRef.current);
                crossfadeTimeoutRef.current = null;
              }

              // Start immediate crossfade with proper error handling
              startCrossfadeTransition(
                playNextRef,
                () => nextSongCacheRef.current || getAndCacheNextSong(playerStateRef, settingsRef, playHistoryRef),
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
                audioContextRef,
                invalidateNextSongCache
              ).catch((error: any) => {
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

      try {
        await audioRef.current.play();
        setPlayerState((prev) => ({ ...prev, isPlaying: true }));
        updateDiscordPresence(playerState.currentSong, true);
      } catch (error) {
        setPlayerState((prev) => ({ ...prev, isPlaying: false }));
      }
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

    // Clear any pending timeouts
    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current);
      crossfadeTimeoutRef.current = null;
    }
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = null;
    }

    // Use cached next song if available, otherwise get it using the same logic as crossfade
    let nextSong: Song | null = null;

    if (nextSongCacheRef.current && nextSongCacheValidRef.current) {
      nextSong = nextSongCacheRef.current;
      // Clear the cache since we're using it
      nextSongCacheRef.current = null;
      nextSongCacheValidRef.current = false;
    } else {
      // Get next song using the same logic as crossfade
      nextSong = getAndCacheNextSong(playerStateRef, settingsRef, playHistoryRef);
    }

    if (nextSong) {
      // Update play history for shuffle mode
      if (playerState.shuffle) {
        updatePlayHistory(playHistoryRef, playerState.currentSong.id);
      }

      playSong(nextSong, playerState.currentPlaylist);
    }
  }, [
    playerState,
    settings.smartShuffle,
    updatePlayHistory,
    playSong,
    getAndCacheNextSong,
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

    // Clear any pending timeouts
    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current);
      crossfadeTimeoutRef.current = null;
    }
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = null;
    }

    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s) => s.id === playerState.currentSong!.id
    );

    let previousSong: Song | null = null;

    if (playerState.shuffle) {
      // In shuffle mode, "previous" just picks another random song using the same logic
      previousSong = getAndCacheNextSong(playerStateRef, settingsRef, playHistoryRef);
    } else {
      // Sequential play - go to previous song
      if (currentIndex > 0) {
        previousSong = songs[currentIndex - 1];
      } else if (playerState.repeat === "all") {
        previousSong = songs[songs.length - 1];
      }
    }

    if (previousSong) {
      // Update play history for shuffle mode
      if (playerState.shuffle) {
        updatePlayHistory(playHistoryRef, playerState.currentSong.id);
      }

      playSong(previousSong, playerState.currentPlaylist);
    }
  }, [
    playerState,
    settings.smartShuffle,
    updatePlayHistory,
    playSong,
    getAndCacheNextSong,
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
    // Invalidate next song cache when shuffle mode changes
    invalidateNextSongCache(true);
  }, [invalidateNextSongCache]);

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
      const beforeSeek = audioRef.current.currentTime;
      console.log("Seeking to:", time, "from:", beforeSeek, "readyState:", audioRef.current.readyState);
      audioRef.current.currentTime = time;
      
      // Check if seek actually worked
      setTimeout(() => {
        const afterSeek = audioRef.current?.currentTime;
        console.log("After seek - requested:", time, "actual:", afterSeek);
        if (Math.abs((afterSeek || 0) - time) > 0.1) {
          console.warn("Seek failed or was overridden!");
        }
      }, 100);
      
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