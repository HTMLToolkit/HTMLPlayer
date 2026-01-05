import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { toggleMiniplayer } from "../components/Miniplayer";
import { CrossfadeManager, AudioSource } from "../helpers/crossfadeHelper";
import DiscordService from "../helpers/discordService";
import { getValidPlaybackRate } from "../helpers/musicPlayerUtils";
import { createCacheManager } from "../helpers/cacheManager";
import {
  getSmartShuffledSong,
  createNextSongManager,
} from "../helpers/shuffleManager";
import { createCrossfadeManager } from "../helpers/crossfadeUtils";
import { calculateGaplessOffsets } from "../helpers/gaplessHelper";
import { createPlaylistManager } from "../helpers/playlistManager";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import { getSafariAudioManager } from "../contexts/audioStore";
import { isSafari } from "../helpers/safariHelper";

export const useMusicPlayer = () => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const songCacheRef = useRef<Map<string, CachedSong>>(new Map());

  // Safari audio manager for background playback support
  const safariAudioRef = useRef(getSafariAudioManager());

  // --- AudioBufferSourceNode for flo (non-Safari) ---
  const floBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const floAudioBufferRef = useRef<AudioBuffer | null>(null);
  const floStartTimeRef = useRef<number>(0);
  const floPausedAtRef = useRef<number>(0);
  const floIsPlayingRef = useRef<boolean>(false);
  const floGainNodeRef = useRef<GainNode | null>(null);

  // Simplified crossfade-related refs
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeManagerRef = useRef<CrossfadeManager | null>(null);
  const currentAudioSourceRef = useRef<AudioSource | null>(null);
  const nextAudioSourceRef = useRef<AudioSource | null>(null);
  const preloadTimeoutRef = useRef<number | null>(null);
  const crossfadeTimeoutRef = useRef<number | null>(null);
  const gaplessAdvanceTriggeredRef = useRef<boolean>(false);
  const gaplessStartAppliedRef = useRef<boolean>(false);

  // Guard to prevent multiple crossfade triggers from timeupdate events
  const crossfadeInitiatedRef = useRef<boolean>(false);

  // Cache the next song decision
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
    view: "home",
  });

  const [settings, setSettings] = useState<PlayerSettings>({
    volume: 0.75,
    crossfade: 3,
    colorTheme: "Blue",
    wallpaper: "None",
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
    pitch: 0,
    gaplessPlayback: false,
    smartShuffle: true,
    discordEnabled: false,
    discordUserId: undefined,
    erudaEnabled: false,
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
    [],
  );

  const debouncedSaveSettings = useCallback(
    debounce(
      async (
        settings: PlayerSettings,
        playHistory: Map<string, { lastPlayed: number; playCount: number }>,
      ) => {
        try {
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
      300,
    ),
    [],
  );

  // Initialize the managers
  const cacheManager = createCacheManager(songCacheRef);
  const nextSongManager = createNextSongManager(
    nextSongCacheRef,
    nextSongCacheValidRef,
  );
  const crossfadeManager = createCrossfadeManager(
    audioRef,
    nextAudioRef,
    crossfadeManagerRef,
    currentAudioSourceRef,
    nextAudioSourceRef,
    gaplessAdvanceTriggeredRef,
    gaplessStartAppliedRef,
  );
  const playlistManager = createPlaylistManager(
    setLibrary,
    library,
    setSearchQuery,
    searchQuery,
    setPlayerState,
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

  const {
    createPlaylist,
    createFolder,
    removePlaylist,
    addToFavorites,
    removeFromFavorites,
    addToPlaylist,
    reorderPlaylistSongs,
    moveSongToPlaylist,
    moveToFolder,
    toggleFavorite,
    isFavorited,
    getFavoriteSongs,
    searchSongs,
    getSearchResults,
    navigateToHome,
    navigateToArtist,
    navigateToAlbum,
    navigateToSongs,
    exportPlaylist,
    importPlaylist,
  } = playlistManager;

  const setupAudioContext = useCallback(() => {
    // Skip Web Audio API setup on Safari for non-flo playback (crossfade/gapless)
    // But allow for flo playback
    const isSafari = safariAudioRef.current.isActive();
    const currentSong = playerStateRef.current.currentSong;
    const isFlo =
      currentSong?.url?.toLowerCase().endsWith(".flo") ||
      currentSong?.mimeType === "audio/x-flo";
    if (isSafari && !isFlo) {
      console.log(
        "[Safari] Skipping Web Audio API setup for non-flo playback compatibility",
      );
      return;
    }

    if (!audioContextRef.current && audioRef.current) {
      const context = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();

      audioContextRef.current = context;

      // Setup crossfade manager with the new audio context (only if not Safari or if flo)
      if (!isSafari || isFlo) {
        const manager = setupCrossfadeManager(context);
        if (manager) {
          const analyserNode = manager.getAnalyzerNode();
          setPlayerState((prev) => ({ ...prev, analyserNode }));
        }
      }

      console.log("[Audio Context] Created and initialized");
    }
  }, [setupCrossfadeManager]);

  // Keep AudioContext alive for background playback (non-Safari browsers)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Resume AudioContext if suspended
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "suspended"
      ) {
        console.log("[Audio Context] Resuming suspended context");
        audioContextRef.current.resume();
      }
    };

    const handleFocus = () => {
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "suspended"
      ) {
        console.log("[Audio Context] Resuming on focus");
        audioContextRef.current.resume();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Update currentTime for flo playback
  useEffect(() => {
    let animationFrame: number;
    const updateTime = () => {
      if (floIsPlayingRef.current && audioContextRef.current) {
        const currentTime = Math.max(
          0,
          audioContextRef.current.currentTime - floStartTimeRef.current,
        );
        setPlayerState((prev) => {
          // Only update if time changed significantly to avoid excessive re-renders
          if (Math.abs(prev.currentTime - currentTime) > 0.1) {
            return { ...prev, currentTime };
          }
          return prev;
        });
      }
      animationFrame = requestAnimationFrame(updateTime);
    };
    updateTime(); // Start immediately
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []); // Empty deps, runs once

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      cleanupCrossfadeManager();

      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }

      clearAllCache();
    };
  }, []);

  // Initialize data loading with batched processing to prevent RAM spikes
  useEffect(() => {
    const BATCH_SIZE = 100; // Process songs in batches of 100
    const BATCH_DELAY = 10; // ms delay between batches to let GC run

    // Helper to process songs in batches to prevent RAM spikes
    const processSongsInBatches = async (songs: Song[]): Promise<Song[]> => {
      if (songs.length <= BATCH_SIZE) {
        // Small library, process all at once
        return songs.filter((song: Song) => song.url && song.url !== "");
      }

      const validSongs: Song[] = [];

      for (let i = 0; i < songs.length; i += BATCH_SIZE) {
        const batch = songs.slice(i, i + BATCH_SIZE);
        const validBatch = batch.filter(
          (song: Song) => song.url && song.url !== "",
        );
        validSongs.push(...validBatch);

        // Yield to main thread between batches
        if (i + BATCH_SIZE < songs.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
        }
      }

      return validSongs;
    };

    // Helper to prepare songs in batches
    const prepareSongsInBatches = async (songs: Song[]): Promise<Song[]> => {
      if (songs.length <= BATCH_SIZE) {
        return prepareSongsForPlaylist(songs);
      }

      const preparedSongs: Song[] = [];

      for (let i = 0; i < songs.length; i += BATCH_SIZE) {
        const batch = songs.slice(i, i + BATCH_SIZE);
        const preparedBatch = prepareSongsForPlaylist(batch);
        preparedSongs.push(...preparedBatch);

        // Yield to main thread between batches
        if (i + BATCH_SIZE < songs.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
        }
      }

      return preparedSongs;
    };

    const loadPersistedData = async () => {
      try {
        const persistedLibrary = await musicIndexedDbHelper.loadLibrary();
        const persistedSettings = await musicIndexedDbHelper.loadSettings();

        if (persistedLibrary) {
          // Process songs in batches to prevent RAM spike
          const validSongs = await processSongsInBatches(
            persistedLibrary.songs,
          );

          const validLibrary = {
            ...persistedLibrary,
            songs: validSongs,
          };

          // Prepare songs for playlist in batches
          const preparedSongs = await prepareSongsInBatches(validLibrary.songs);

          const allSongsPlaylist = {
            id: "all-songs",
            name: t("allSongs"),
            songs: preparedSongs,
          };

          const updatedLibrary = {
            ...validLibrary,
            playlists: validLibrary.playlists.some(
              (p: any) => p.id === "all-songs",
            )
              ? validLibrary.playlists.map((p: any) =>
                p.id === "all-songs"
                  ? {
                    ...p,
                    songs: preparedSongs, // Reuse already prepared songs
                  }
                  : p,
              )
              : [allSongsPlaylist, ...validLibrary.playlists],
          };

          setLibrary(updatedLibrary);

          let songToPlay: Song | null = null;
          let playlistToSet: Playlist | null = null;

          if (persistedSettings?.sessionRestore !== false) {
            if (persistedSettings?.lastPlayedSongId) {
              songToPlay =
                updatedLibrary.songs.find(
                  (s: Song) => s.id === persistedSettings.lastPlayedSongId,
                ) || null;
            }
            if (persistedSettings?.lastPlayedPlaylistId) {
              playlistToSet =
                updatedLibrary.playlists.find(
                  (p: Playlist) =>
                    p.id === persistedSettings.lastPlayedPlaylistId,
                ) || null;
            }
          }

          if (
            !playlistToSet ||
            !playlistToSet.songs ||
            playlistToSet.songs.length === 0
          ) {
            playlistToSet = allSongsPlaylist;
          }

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
            // On Safari, force disable gapless playback and crossfade
            // since Web Audio API is not used for background compatibility
            const isSafari = safariAudioRef.current.isActive();
            if (isSafari) {
              persistedSettings.gaplessPlayback = false;
              persistedSettings.crossfade = 0;
            }

            // Ensure pitch has a valid default value to prevent NaN errors
            if (
              persistedSettings.pitch === undefined ||
              persistedSettings.pitch === null ||
              isNaN(persistedSettings.pitch)
            ) {
              persistedSettings.pitch = 0;
            }

            setSettings(persistedSettings);
            if (persistedSettings.playHistory) {
              playHistoryRef.current = new Map(persistedSettings.playHistory);
              console.log(
                "Restored play history with",
                persistedSettings.playHistory.length,
                "entries",
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

  // Save data when changed (same as before)
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

    if (previousSettings.smartShuffle !== settings.smartShuffle) {
      console.log("Smart shuffle setting changed, invalidating cache");
      invalidateNextSongCache(true);
    }
  }, [settings, invalidateNextSongCache]);

  useEffect(() => {
    const previousState = playerStateRef.current;
    playerStateRef.current = playerState;

    const shouldInvalidate =
      previousState.currentPlaylist?.id !== playerState.currentPlaylist?.id ||
      (previousState.shuffle !== playerState.shuffle && playerState.shuffle) ||
      previousState.repeat !== playerState.repeat;

    if (shouldInvalidate) {
      console.log("Player state changed significantly, invalidating cache");
      invalidateNextSongCache(true);
    }
  }, [playerState, invalidateNextSongCache]);

  // Update playlist when library changes
  useEffect(() => {
    if (playerState.currentPlaylist) {
      // Recursive function to find playlist in the tree
      const findPlaylist = (
        items: (Playlist | PlaylistFolder)[],
      ): Playlist | null => {
        for (const item of items) {
          if ("songs" in item && item.id === playerState.currentPlaylist?.id) {
            return item;
          }
          if ("children" in item) {
            const found = findPlaylist(item.children);
            if (found) return found;
          }
        }
        return null;
      };
      const updatedPlaylist = findPlaylist(library.playlists);
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

  // Update master volume through crossfade manager
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

  // Media session and last played updates (same as before)
  useEffect(() => {
    if (!isInitialized) return;

    if (settings.sessionRestore) {
      setSettings((prev) => ({
        ...prev,
        lastPlayedSongId: playerState.currentSong?.id ?? prev.lastPlayedSongId,
        lastPlayedPlaylistId:
          playerState.currentPlaylist?.id ?? prev.lastPlayedPlaylistId,
      }));
    }

    if ("mediaSession" in navigator && playerState.currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playerState.currentSong.title,
        artist: playerState.currentSong.artist,
        album: playerState.currentSong.album,
        artwork: playerState.currentSong.albumArt
          ? [{ src: playerState.currentSong.albumArt }]
          : [],
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playPrevious();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playNext();
      });

      // Seek handlers for system controls
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const skipTime = details.seekOffset || 10; // Default 10 seconds
        const currentTime = playerState.currentTime;
        const duration = playerState.duration || 0;
        const newTime = Math.min(currentTime + skipTime, duration);
        seekTo(newTime);
      });

      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const skipTime = details.seekOffset || 10; // Default 10 seconds
        const currentTime = playerState.currentTime;
        const newTime = Math.max(currentTime - skipTime, 0);
        seekTo(newTime);
      });

      // Only set enterpictureinpicture handler if supported
      try {
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
          },
        );
      } catch (error) {
        // Browser doesn't support enterpictureinpicture action
        console.log("enterpictureinpicture action not supported");
      }

      return () => {
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
          navigator.mediaSession.setActionHandler("seekto", null);
          navigator.mediaSession.setActionHandler("seekforward", null);
          navigator.mediaSession.setActionHandler("seekbackward", null);
          try {
            navigator.mediaSession.setActionHandler(
              "enterpictureinpicture" as any,
              null,
            );
          } catch (error) {
            // Browser doesn't support enterpictureinpicture action
          }
        }
      };
    }
  }, [playerState.currentSong, playerState.currentPlaylist, isInitialized]);

  // Update tempo and pitch when settings change (combined playbackRate)
  useEffect(() => {
    const combinedRate = getValidPlaybackRate(settings.tempo, settings.pitch);

    if (audioRef.current) {
      audioRef.current.playbackRate = combinedRate;
    }
    if (nextAudioRef.current) {
      nextAudioRef.current.playbackRate = combinedRate;
    }

    // No need to sync - on Safari, audioRef.current IS the Safari element
  }, [settings.tempo, settings.pitch]);

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
          await discordService.clearPresence(settings.discordUserId);
        }
      } catch (error) {
        console.error("Failed to update Discord presence:", error);
      }
    },
    [settings.discordEnabled, settings.discordUserId],
  );

  // Improved preload function
  const smartPreloadNextSong = useCallback(async () => {
    if (
      isPreloadingRef.current ||
      !playerState.currentSong ||
      !playerState.currentPlaylist
    ) {
      return;
    }

    if (playerState.repeat === "one") {
      return;
    }

    isPreloadingRef.current = true;

    try {
      const nextSong = getAndCacheNextSong(
        playerStateRef,
        settingsRef,
        playHistoryRef,
      );

      if (nextSong) {
        nextSongCacheRef.current = nextSong;
        nextSongCacheValidRef.current = true;

        if (settings.crossfade > 0 && nextAudioRef.current) {
          const isFlo =
            nextSong.url?.toLowerCase().endsWith(".flo") ||
            nextSong.mimeType === "audio/x-flo";
          if (!isFlo) {
            await preloadNextSong(
              () => nextSong,
              cacheSong,
              getCachedSong,
              settingsRef,
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to preload next song:", error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [
    playerState,
    settings,
    preloadNextSong,
    cacheSong,
    getCachedSong,
    getAndCacheNextSong,
  ]);

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
        ? { ...song, url: `indexeddb://${song.id}` }
        : song;

      // Cache the song
      await cacheSong(songToPlay);
      const cachedSong = getCachedSong(song.id);
      if (!cachedSong) {
        console.error("Failed to play song: could not cache");
        return;
      }

      // Prepare playlist
      const preparedPlaylist =
        playlist && "songs" in playlist
          ? { ...playlist, songs: prepareSongsForPlaylist(playlist.songs) }
          : playerStateRef.current.currentPlaylist;

      setPlayerState((prev) => ({
        ...prev,
        currentSong: song,
        currentPlaylist: preparedPlaylist,
        isPlaying: true,
        currentTime: 0,
      }));

      // Track play history
      if (
        playerStateRef.current.currentSong &&
        playerStateRef.current.currentSong.id !== song.id
      ) {
        updatePlayHistory(playHistoryRef, playerStateRef.current.currentSong.id);
      }

      // Check if this is a pre-decoded WAV (Safari path)
      const isFloWav = song.mimeType === "audio/wav" && song.encoding?.codec === "flo";

      // Check if this is pre-decoded PCM (non-Safari path)
      const isFloPcm =
        song.mimeType === "audio/pcm" ||
        song.encoding?.codec === "pcm-float32";

      // Check if this is original flo
      const isFloOriginal =
        song.mimeType === "audio/x-flo" ||
        song.url?.toLowerCase().endsWith(".flo");

      if (isFloWav) {
        // Play pre-decoded WAV (Safari)
        try {
          let wavBuffer: ArrayBuffer | undefined;

          if (song.hasStoredAudio && song.url.startsWith("indexeddb://")) {
            const audioData = await musicIndexedDbHelper.loadSongAudio(song.id);
            wavBuffer = audioData?.fileData;
          } else if (song.url && song.url.startsWith("blob:")) {
            const res = await fetch(song.url);
            wavBuffer = await res.arrayBuffer();
          }

          if (!wavBuffer) {
            throw new Error("Could not load WAV data for playback");
          }

          const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
          const wavUrl = URL.createObjectURL(wavBlob);

          if (audioRef.current) {
            audioRef.current.src = wavUrl;
            audioRef.current.playbackRate = getValidPlaybackRate(
              settingsRef.current.tempo,
              settingsRef.current.pitch,
            );
            await audioRef.current.play();
          } else {
            throw new Error("Audio element not available");
          }
        } catch (error: any) {
          console.error("Failed to play pre-decoded flo (WAV):", error);
          toast.error(`Failed to play "${song.title}" (flo)`, {
            description: error.message || "Unknown error occurred",
          });
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
          return;
        }
      } else if (isFloPcm) {
        // Play pre-decoded PCM using AudioBufferSourceNode
        try {
          let pcmBuffer: ArrayBuffer | undefined;

          if (song.hasStoredAudio && song.url.startsWith("indexeddb://")) {
            const audioData = await musicIndexedDbHelper.loadSongAudio(song.id);
            pcmBuffer = audioData?.fileData;
          } else if (song.url && song.url.startsWith("blob:")) {
            const res = await fetch(song.url);
            pcmBuffer = await res.arrayBuffer();
          }

          if (!pcmBuffer) {
            throw new Error("Could not load PCM data for playback");
          }

          if (!audioContextRef.current) setupAudioContext();
          const ctx = audioContextRef.current;
          if (!ctx) throw new Error("AudioContext not available");

          // Stop any previous buffer source
          if (floBufferSourceRef.current) {
            try {
              floBufferSourceRef.current.stop();
            } catch { }
            floBufferSourceRef.current.disconnect();
            floBufferSourceRef.current = null;
          }

          // Reconstruct AudioBuffer from interleaved PCM data
          const sampleRate = song.encoding?.sampleRate || 44100;
          const channels = song.encoding?.channels || 2;
          const pcmData = new Float32Array(pcmBuffer);
          const frameCount = pcmData.length / channels;

          const audioBuffer = ctx.createBuffer(channels, frameCount, sampleRate);

          // Deinterleave
          for (let ch = 0; ch < channels; ch++) {
            const channelData = audioBuffer.getChannelData(ch);
            for (let i = 0; i < frameCount; i++) {
              channelData[i] = pcmData[i * channels + ch];
            }
          }

          floAudioBufferRef.current = audioBuffer;

          // Create source node
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;

          // Connect through gain node for volume control
          if (!floGainNodeRef.current) {
            floGainNodeRef.current = ctx.createGain();
            floGainNodeRef.current.connect(ctx.destination);
          }
          source.connect(floGainNodeRef.current);
          floGainNodeRef.current.gain.value = settingsRef.current.volume;

          source.onended = () => {
            floIsPlayingRef.current = false;
            setPlayerState((prev) => ({
              ...prev,
              isPlaying: false,
              currentTime: audioBuffer.duration,
            }));
          };

          floBufferSourceRef.current = source;
          floStartTimeRef.current = ctx.currentTime;
          floPausedAtRef.current = 0;
          floIsPlayingRef.current = true;

          setPlayerState((prev) => ({
            ...prev,
            isPlaying: true,
            currentTime: 0,
            duration: audioBuffer.duration,
          }));

          source.start();
        } catch (error: any) {
          console.error("Failed to play pre-decoded flo (PCM):", error);
          toast.error(`Failed to play "${song.title}" (flo)`, {
            description: error.message || "Unknown error occurred",
          });
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
          return;
        }
      } else if (isFloOriginal) {
        // Decode flo on-demand and play
        try {
          let floBuffer: ArrayBuffer | undefined;

          if (song.hasStoredAudio && song.url.startsWith("indexeddb://")) {
            const audioData = await musicIndexedDbHelper.loadSongAudio(song.id);
            floBuffer = audioData?.fileData;
          } else if (song.url && song.url.startsWith("blob:")) {
            const res = await fetch(song.url);
            floBuffer = await res.arrayBuffer();
          }

          if (!floBuffer) {
            throw new Error("Could not load flo data for playback");
          }

          // Decode flo to AudioBuffer
          const { decodeFloToAudioBuffer } = await import("../helpers/floProcessor");
          if (!audioContextRef.current) setupAudioContext();
          const ctx = audioContextRef.current;
          if (!ctx) throw new Error("AudioContext not available");

          const audioBuffer = await decodeFloToAudioBuffer(floBuffer, ctx);

          // Stop any previous buffer source
          if (floBufferSourceRef.current) {
            try {
              floBufferSourceRef.current.stop();
            } catch { }
            floBufferSourceRef.current.disconnect();
            floBufferSourceRef.current = null;
          }

          floAudioBufferRef.current = audioBuffer;

          // Create and play
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;

          if (!floGainNodeRef.current) {
            floGainNodeRef.current = ctx.createGain();
            floGainNodeRef.current.connect(ctx.destination);
          }
          source.connect(floGainNodeRef.current);
          floGainNodeRef.current.gain.value = settingsRef.current.volume;

          source.onended = () => {
            floIsPlayingRef.current = false;
            setPlayerState((prev) => ({
              ...prev,
              isPlaying: false,
              currentTime: audioBuffer.duration,
            }));
          };

          floBufferSourceRef.current = source;
          floStartTimeRef.current = ctx.currentTime;
          floPausedAtRef.current = 0;
          floIsPlayingRef.current = true;

          setPlayerState((prev) => ({
            ...prev,
            isPlaying: true,
            currentTime: 0,
            duration: audioBuffer.duration,
          }));

          source.start();
        } catch (error: any) {
          console.error("Failed to decode and play flo:", error);
          toast.error(`Failed to play "${song.title}" (flo)`, {
            description: error.message || "Unknown error occurred",
          });
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
          return;
        }
      } else {
        if (audioRef.current) {
          // Cancel any ongoing crossfade
          if (crossfadeManagerRef.current?.isCrossfading()) {
            crossfadeManagerRef.current.cancelCrossfade();
          }

          gaplessAdvanceTriggeredRef.current = false;
          gaplessStartAppliedRef.current = false;
          crossfadeInitiatedRef.current = false;

          audioRef.current.src = cachedSong.url;
          const combinedRate = getValidPlaybackRate(
            settingsRef.current.tempo,
            settingsRef.current.pitch,
          );
          audioRef.current.playbackRate = combinedRate;

          if (!audioContextRef.current) setupAudioContext();
          if (audioContextRef.current && !crossfadeManagerRef.current) {
            setupCrossfadeManager(audioContextRef.current);
          }
          if (crossfadeManagerRef.current) {
            if (
              !currentAudioSourceRef.current ||
              currentAudioSourceRef.current.element !== audioRef.current
            ) {
              currentAudioSourceRef.current =
                crossfadeManagerRef.current.createAudioSource(audioRef.current);
            }
            crossfadeManagerRef.current.setCurrentSource(
              currentAudioSourceRef.current,
            );
          }

          try {
            await audioRef.current.play();
          } catch (error: any) {
            const isInterruptedError =
              error.name === "AbortError" ||
              error.message?.includes("interrupted");

            if (isInterruptedError) {
              console.debug("Play interrupted, this is expected");
              setPlayerState((prev) => ({ ...prev, isPlaying: false }));
              return;
            }

            console.error("Failed to play song:", error);
            toast.error(`Failed to play "${song.title}"`, {
              description: error.message || "Unknown error occurred",
            });
            setPlayerState((prev) => ({ ...prev, isPlaying: false }));
            return;
          }

          if (playlist) {
            updateSongCache(
              song,
              playlist,
              playerStateRef,
              settingsRef,
              playHistoryRef,
              getSmartShuffledSong,
            );
          }

          updateDiscordPresence(song, true);
          invalidateNextSongCache();

          preloadTimeoutRef.current = window.setTimeout(() => {
            smartPreloadNextSong();
          }, 2000);
        }
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
    ],
  );

  // Audio event handling setup
  useEffect(() => {
    // Initialize primary audio element
    // On Safari, use the Safari audio element as the primary element (it's in the DOM)
    // This allows background playback while still using Web Audio API for processing
    const safariElement = safariAudioRef.current.getElement();
    if (safariElement) {
      console.log("[Music Player] Using Safari audio element as primary audio");
      audioRef.current = safariElement;
      // Unmute it since it's now the primary audio source
      safariElement.muted = false;
      safariElement.volume = settingsRef.current.volume;
    } else {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
    }
    // Initial playback rate will be set by the tempo/pitch effect

    // Initialize secondary audio element for crossfading
    nextAudioRef.current = new Audio();
    nextAudioRef.current.crossOrigin = "anonymous";
    // Initial playback rate will be set by the tempo/pitch effect

    const audio = audioRef.current;

    const handleTimeUpdate = (event: Event) => {
      const target = event.target as HTMLAudioElement;
      const currentAudio = audioRef.current;
      const nextAudio = nextAudioRef.current;

      let shouldUpdateFrom = currentAudio;

      // During crossfade, use the next audio element since that's the song becoming current
      // But only if the crossfade is actually in progress and hasn't failed
      if (
        crossfadeManagerRef.current?.isCrossfading() &&
        nextAudio &&
        nextAudio.src &&
        !nextAudio.src.includes("about:blank")
      ) {
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

      // Update Media Session position state for system controls
      if (
        "mediaSession" in navigator &&
        "setPositionState" in navigator.mediaSession
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: target.duration || 0,
            playbackRate: target.playbackRate || 1,
            position: target.currentTime || 0,
          });
        } catch (error) {
          // Ignore errors (some browsers may not support all parameters)
        }
      }

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
        const offsets = gaplessEnabled
          ? calculateGaplessOffsets(playerStateRef.current.currentSong)
          : { start: 0, end: 0 };

        const trimmedDuration =
          currentAudio.duration - offsets.start - offsets.end;
        const effectiveDuration =
          Number.isFinite(trimmedDuration) && trimmedDuration > 0.1
            ? trimmedDuration
            : currentAudio.duration;
        const elapsedInContent = Math.max(
          0,
          currentAudio.currentTime - offsets.start,
        );
        const timeRemaining = Math.max(0, effectiveDuration - elapsedInContent);
        const hasMeaningfulGaplessOffsets =
          gaplessEnabled && (offsets.start > 0 || offsets.end > 0);

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
          if (
            timeRemaining <= crossfadeDuration &&
            !crossfadeInitiatedRef.current
          ) {
            // Set guard immediately to prevent re-triggering
            crossfadeInitiatedRef.current = true;
            console.log(
              "Triggering crossfade at",
              timeRemaining.toFixed(1),
              "seconds remaining",
            );
            startCrossfadeTransition(
              playNextRef,
              () =>
                nextSongCacheRef.current ||
                getAndCacheNextSong(
                  playerStateRef,
                  settingsRef,
                  playHistoryRef,
                ),
              (nextSong: Song) =>
                prepareNextSongForCrossfade(
                  nextSong,
                  cacheSong,
                  getCachedSong,
                  settingsRef,
                ),
              playerStateRef,
              playHistoryRef,
              updatePlayHistory,
              setPlayerState,
              settingsRef,
              audioContextRef,
              invalidateNextSongCache,
              gaplessAdvanceTriggeredRef,
              gaplessStartAppliedRef,
            ).catch((error: any) => {
              console.error("Crossfade transition failed:", error);
              // Reset guard on failure so it can be retried
              crossfadeInitiatedRef.current = false;
            });
          }
        } else if (gaplessEnabled) {
          // For gapless playback, prepare next song earlier
          if (timeRemaining <= 3 && timeRemaining > 2.5) {
            if (!isPreloadingRef.current) {
              smartPreloadNextSong();
            }
          }

          if (
            hasMeaningfulGaplessOffsets &&
            timeRemaining <= 0.15 &&
            !gaplessAdvanceTriggeredRef.current
          ) {
            gaplessAdvanceTriggeredRef.current = true;

            // Schedule the advance with precise timing to minimize gap
            const delayMs = Math.max(0, (timeRemaining - 0.02) * 1000);

            if (autoPlayNext && playNextRef.current) {
              if (delayMs > 0) {
                setTimeout(() => playNextRef.current?.(), delayMs);
              } else {
                playNextRef.current();
              }
            } else if (!autoPlayNext) {
              if (delayMs > 0) {
                setTimeout(() => {
                  currentAudio.pause();
                  setPlayerState((prev) => ({ ...prev, isPlaying: false }));
                }, delayMs);
              } else {
                currentAudio.pause();
                setPlayerState((prev) => ({ ...prev, isPlaying: false }));
              }
            }
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;

      let effectiveDuration = currentAudio.duration;

      if (settingsRef.current.gaplessPlayback) {
        const offsets = calculateGaplessOffsets(
          playerStateRef.current.currentSong,
        );

        if (
          !gaplessStartAppliedRef.current &&
          offsets.start > 0 &&
          offsets.start < currentAudio.duration
        ) {
          try {
            currentAudio.currentTime = offsets.start;
            gaplessStartAppliedRef.current = true;
          } catch (error) {
            console.warn("Failed to apply gapless start offset:", error);
          }
        }

        const trimmedDuration =
          currentAudio.duration - offsets.start - offsets.end;
        if (Number.isFinite(trimmedDuration) && trimmedDuration > 0.1) {
          effectiveDuration = trimmedDuration;
        }
      }

      setPlayerState((prev) => ({
        ...prev,
        duration: effectiveDuration,
      }));
    };

    const handleEnded = (event: Event) => {
      const target = event.target as HTMLAudioElement;

      // Determine which element should be considered "current"
      // Use crossfade manager's active element if available, otherwise audioRef
      const activeElement =
        crossfadeManagerRef.current?.getActiveElement() || audioRef.current;

      // Only respond to ended events from the active element
      if (target !== activeElement) {
        return;
      }

      // If crossfade is in progress and current (outgoing) song ends,
      // the crossfade manager handles this via its own 'ended' listener
      // So we should not trigger playNext here
      if (crossfadeManagerRef.current?.isCrossfading()) {
        console.log(
          "Current song ended during crossfade - letting crossfade manager handle it",
        );
        // Reset the crossfade initiated flag since crossfade is completing
        crossfadeInitiatedRef.current = false;
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
                "Starting immediate crossfade transition on song end",
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
                  nextSongCacheRef.current ||
                  getAndCacheNextSong(
                    playerStateRef,
                    settingsRef,
                    playHistoryRef,
                  ),
                (nextSong: Song) =>
                  prepareNextSongForCrossfade(
                    nextSong,
                    cacheSong,
                    getCachedSong,
                    settingsRef,
                  ),
                playerStateRef,
                playHistoryRef,
                updatePlayHistory,
                setPlayerState,
                settingsRef,
                audioContextRef,
                invalidateNextSongCache,
                gaplessAdvanceTriggeredRef,
                gaplessStartAppliedRef,
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

    // Attach timeupdate and loadedmetadata to secondary audio element for crossfading
    const nextAudio = nextAudioRef.current;
    nextAudio.addEventListener("timeupdate", handleTimeUpdate);
    nextAudio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);

      nextAudio.removeEventListener("timeupdate", handleTimeUpdate);
      nextAudio.removeEventListener("loadedmetadata", handleLoadedMetadata);

      audio.pause();
      nextAudio.pause();
    };
  }, []);

  const togglePlayPause = useCallback(async () => {
    const isFlo =
      playerState.currentSong?.url?.toLowerCase().endsWith(".flo") ||
      playerState.currentSong?.mimeType === "audio/x-flo" ||
      playerState.currentSong?.mimeType === "audio/wav" ||
      playerState.currentSong?.mimeType === "audio/pcm" ||
      playerState.currentSong?.encoding?.codec === "flo";
    if (isFlo && !isSafari()) {
      // AudioBufferSourceNode path
      const ctx = audioContextRef.current;
      if (!ctx || !floAudioBufferRef.current) return;
      if (floIsPlayingRef.current) {
        // Pause: stop source, record pausedAt
        try {
          floBufferSourceRef.current?.stop();
        } catch { }
        floPausedAtRef.current = ctx.currentTime - floStartTimeRef.current;
        floIsPlayingRef.current = false;
        setPlayerState((prev) => ({ ...prev, isPlaying: false }));
      } else {
        // Resume: create new source, start at pausedAt
        const source = ctx.createBufferSource();
        source.buffer = floAudioBufferRef.current;
        if (floGainNodeRef.current) {
          source.connect(floGainNodeRef.current);
        } else {
          source.connect(ctx.destination);
        }
        source.onended = () => {
          floIsPlayingRef.current = false;
          setPlayerState((prev) => ({
            ...prev,
            isPlaying: false,
            currentTime: floAudioBufferRef.current?.duration || 0,
          }));
        };
        floBufferSourceRef.current = source;
        floStartTimeRef.current = ctx.currentTime - floPausedAtRef.current;
        floIsPlayingRef.current = true;
        setPlayerState((prev) => ({ ...prev, isPlaying: true }));
        source.start(0, floPausedAtRef.current);
      }
      return;
    }
    // Default path
    if (!audioRef.current || !playerState.currentSong) return;
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState((prev) => ({ ...prev, isPlaying: false }));
      updateDiscordPresence(playerState.currentSong, false);
    } else {
      if (
        !audioRef.current.src ||
        audioRef.current.src.includes("about:blank")
      ) {
        await playSong(
          playerState.currentSong,
          playerState.currentPlaylist || undefined,
        );
        return;
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
      nextSong = getAndCacheNextSong(
        playerStateRef,
        settingsRef,
        playHistoryRef,
      );
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
      (s) => s.id === playerState.currentSong!.id,
    );

    let previousSong: Song | null = null;

    if (playerState.shuffle) {
      // In shuffle mode, "previous" just picks another random song using the same logic
      previousSong = getAndCacheNextSong(
        playerStateRef,
        settingsRef,
        playHistoryRef,
      );
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

    // Set volume for flo playback
    if (floGainNodeRef.current) {
      floGainNodeRef.current.gain.value = clamped;
    }

    // Safari uses native playback without Web Audio API
    const isSafari = safariAudioRef.current.isActive();
    if (isSafari) {
      if (audioRef.current) {
        audioRef.current.volume = clamped;
      }
      return;
    }

    // Use crossfade manager for volume control if available
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
    // Handle flo seek
    if (
      floIsPlayingRef.current &&
      floAudioBufferRef.current &&
      audioContextRef.current
    ) {
      const ctx = audioContextRef.current;
      // Stop current source
      if (floBufferSourceRef.current) {
        try {
          floBufferSourceRef.current.stop();
        } catch { }
        floBufferSourceRef.current.disconnect();
      }
      // Create new source
      const source = ctx.createBufferSource();
      source.buffer = floAudioBufferRef.current;
      if (floGainNodeRef.current) {
        source.connect(floGainNodeRef.current);
      } else {
        source.connect(ctx.destination);
      }
      source.onended = () => {
        floIsPlayingRef.current = false;
        setPlayerState((prev) => ({
          ...prev,
          isPlaying: false,
          currentTime: floAudioBufferRef.current!.duration,
        }));
      };
      floBufferSourceRef.current = source;
      floStartTimeRef.current = ctx.currentTime - time;
      floPausedAtRef.current = 0;
      source.start(0, time);
      setPlayerState((prev) => ({ ...prev, currentTime: time }));
      return;
    }

    if (audioRef.current) {
      const beforeSeek = audioRef.current.currentTime;
      console.log(
        "Seeking to:",
        time,
        "from:",
        beforeSeek,
        "readyState:",
        audioRef.current.readyState,
      );
      audioRef.current.currentTime = time;

      // No need to sync - on Safari, audioRef.current IS the Safari element

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
    async (song: Song, file?: File) => {
      // First, update library synchronously to show song in UI immediately
      setLibrary((prev) => {
        const newSongs = [...prev.songs, song];
        const allSongsPlaylistExists = prev.playlists.some(
          (p) => p.id === "all-songs",
        );

        let newPlaylists = prev.playlists.map((p) =>
          p.id === "all-songs"
            ? { ...p, songs: prepareSongsForPlaylist(newSongs) }
            : p,
        );

        if (!allSongsPlaylistExists) {
          newPlaylists = [
            {
              id: "all-songs",
              name: t("allSongs"),
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

      // If we have the file, process and store audio in background
      if (file) {
        try {
          // Convert file directly to ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();

          // Save to IndexedDB
          const mimeType = song.mimeType || file.type;
          await musicIndexedDbHelper.saveSongAudio(song.id, {
            fileData: arrayBuffer,
            mimeType,
          });

          // Update song to mark it as stored
          setLibrary((prev) => {
            const newSongs = prev.songs.map((s) =>
              s.id === song.id
                ? { ...s, hasStoredAudio: true, url: `indexeddb://${song.id}`, mimeType }
                : s,
            );
            return {
              ...prev,
              songs: newSongs,
              playlists: prev.playlists.map((p) =>
                p.id === "all-songs"
                  ? { ...p, songs: prepareSongsForPlaylist(newSongs) }
                  : p,
              ),
            };
          });

          console.log(`Successfully stored audio for: ${song.title}`);
        } catch (error) {
          console.error("Failed to process song audio:", error);
          // TODO: i18n-ize
          toast.error(`Failed to process "${song.title}"`, {
            description: (error as Error).message || "Unknown error occurred",
          });
        }
      }
    },
    [prepareSongsForPlaylist, t],
  );

  const removeSong = useCallback(async (songId: string) => {
    // First, update library synchronously
    setLibrary((prev) => {
      const newSongs = prev.songs.filter((s) => s.id !== songId);
      const newPlaylists = prev.playlists.map((p) => {
        if ("songs" in p) {
          return {
            ...p,
            songs: p.songs.filter((s: Song) => s.id !== songId),
          };
        }
        return p;
      });
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
    createFolder,
    removePlaylist,
    addToPlaylist,
    reorderPlaylistSongs,
    moveSongToPlaylist,
    moveToFolder,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorited,
    getFavoriteSongs,
    searchSongs,
    getSearchResults,
    setSearchQuery,
    navigateToHome,
    navigateToArtist,
    navigateToAlbum,
    navigateToSongs,
    exportPlaylist,
    importPlaylist,
  };
};
