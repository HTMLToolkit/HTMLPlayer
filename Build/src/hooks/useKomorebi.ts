import { useEffect, useRef, useCallback } from "react";
import { KomorebiEngine } from "../core/engine/engine";
import type {
  Track,
  Playlist,
  PlaylistFolder,
  EngineState,
} from "../core/engine/types";
import type { IAudioBackend } from "../platform/audio";
import { BackendRouter } from "../platform/audio/backends";
import { PreloadManager } from "../platform/audio/preloader";
import type { Equalizer } from "../platform/audio/equalizer";
import {
  createMediaSessionIntegration,
  createDiscordIntegration,
  DiscordService,
} from "../platform/integrations";
import { LibraryManager } from "../platform/library/library";
import { libraryPersistence } from "../platform/library/persistence";
import { trackStorage } from "../platform/storage/trackStorage";
import { SettingsManager } from "../platform/settings/settings";
import type { SettingsState } from "../platform/settings/types";
import { engineSettingsPersistence } from "../platform/settings/enginePersistence";
import { createLogger } from "../helpers/logger";
import {
  useKomorebiStore,
  EMPTY_ENGINE_STATE,
  selectAutoPlayNext,
  selectCrossfade,
  selectCurrentTrack,
  selectCurrentTime,
  selectDuration,
  selectError,
  selectGapless,
  selectIsLoading,
  selectIsPlaying,
  selectIsReady,
  selectPitch,
  selectRepeat,
  selectShuffle,
  selectSmartShuffle,
  selectSnapshot,
  selectSongs,
  selectTempo,
  selectVolume,
} from "../store";

const logger = createLogger("useKomorebi");

export interface UseKomorebiOptions {
  autoPlay?: boolean;
  persistLibrary?: boolean;
}

export interface UseKomorebiReturn {
  engine: KomorebiEngine;
  library: LibraryManager;
  settings: SettingsManager;

  isReady: boolean;
  isLoading: boolean;

  state: EngineState;
  songs: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  tempo: number;
  pitch: number;
  crossfade: number;
  gapless: boolean;
  smartShuffle: boolean;
  autoPlayNext: boolean;
  repeat: "off" | "one" | "all";
  shuffle: boolean;
  error: string | null;

  play: () => Promise<void>;
  pause: () => void;
  togglePlayPause: () => Promise<void>;
  stop: () => void;
  seek: (time: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setPitch: (semitones: number) => void;
  setCrossfade: (duration: number) => void;
  setGapless: (enabled: boolean) => void;
  setShuffle: (shuffled: boolean) => void;
  setShuffleMode: (mode: "random" | "smart") => void;
  setRepeat: (mode: "off" | "one" | "all") => void;
  setAutoPlayNext: (enabled: boolean) => void;
  getAnalyser: () => AnalyserNode | null;
  getEqualizer: () => Equalizer | null;
  setEqualizerEnabled: (enabled: boolean) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;

  load: (track: Track, playlist?: Playlist) => void;
  playSong: (song: Track, playlist?: Playlist) => Promise<void>;
  setPlaylist: (playlist: Playlist) => void;
  getQueue: () => Track[];

  addSong: (song: Track) => void;
  removeSong: (songId: string) => void;
  getSong: (songId: string) => Track | undefined;

  addPlaylist: (playlist: Playlist) => void;
  removePlaylist: (playlistId: string) => void;
  getPlaylist: (playlistId: string) => Playlist | undefined;

  toggleFavorite: (songId: string) => void;
  isFavorite: (songId: string) => boolean;
  getFavorites: () => Track[];

  search: (query: string) => Track[];
  getSongsByArtist: (artist: string) => Track[];
  getSongsByAlbum: (album: string) => Track[];
}

declare global {
  interface MusicLibrary {
    songs: Track[];
    playlists: (Playlist | PlaylistFolder)[];
    favorites: string[];
  }
}

const LOAD_WAIT_TIMEOUT_MS = 5000;

function restoreEngineSettings(engine: KomorebiEngine): void {
  const stored = engineSettingsPersistence.load();
  if (!stored) return;

  if (stored.volume !== undefined) engine.setVolume(stored.volume);
  if (stored.tempo !== undefined) engine.setTempo(stored.tempo);
  if (stored.pitch !== undefined) engine.setPitch(stored.pitch);
  if (stored.crossfade !== undefined) engine.setCrossfade(stored.crossfade);
  if (stored.gaplessPlayback !== undefined) {
    engine.setGapless(stored.gaplessPlayback);
  }
  if (stored.smartShuffle !== undefined) {
    engine.setShuffleMode(stored.smartShuffle ? "smart" : "random");
  }
  if (stored.repeat !== undefined) engine.setRepeat(stored.repeat);
  if (stored.autoPlayNext !== undefined) {
    engine.setAutoPlayNext(stored.autoPlayNext);
  }
  if (stored.defaultShuffle !== undefined) {
    engine.setShuffle(stored.defaultShuffle);
  }
  if (stored.defaultRepeat !== undefined) {
    engine.updateSettings({ defaultRepeat: stored.defaultRepeat });
  }
}

export function useKomorebi(
  options: UseKomorebiOptions = {},
): UseKomorebiReturn {
  const backendRef = useRef<IAudioBackend | null>(null);
  const engineRef = useRef<KomorebiEngine | null>(null);
  const libraryRef = useRef<LibraryManager | null>(null);
  const playlistsSaveTimerRef = useRef<number | null>(null);
  const settingsRef = useRef<SettingsManager | null>(null);
  const initializedRef = useRef(false);

  if (!initializedRef.current) {
    const backend = new BackendRouter();
    const engine = new KomorebiEngine(backend, {
      crossfade: { enabled: false, duration: 0, shape: "linear" },
      gapless: { enabled: true },
      smartShuffle: true,
      autoPlayNext: options.autoPlay ?? false,
      trackResolver: (track) => trackStorage.reconstructUrl(track),
      preloadManager: new PreloadManager(),
    });
    engineRef.current = engine;
    backendRef.current = backend;

    restoreEngineSettings(engine);

    libraryRef.current = new LibraryManager();
    settingsRef.current = new SettingsManager();
    initializedRef.current = true;
  }

  const snapshot = useKomorebiStore(selectSnapshot);
  const state = snapshot ?? EMPTY_ENGINE_STATE;
  const songs = useKomorebiStore(selectSongs);
  const isReady = useKomorebiStore(selectIsReady);
  const isLoading = useKomorebiStore(selectIsLoading);
  const error = useKomorebiStore(selectError);
  const currentTrack = useKomorebiStore(selectCurrentTrack);
  const isPlaying = useKomorebiStore(selectIsPlaying);
  const currentTime = useKomorebiStore(selectCurrentTime);
  const duration = useKomorebiStore(selectDuration);
  const volume = useKomorebiStore(selectVolume);
  const tempo = useKomorebiStore(selectTempo);
  const pitch = useKomorebiStore(selectPitch);
  const crossfade = useKomorebiStore(selectCrossfade);
  const gapless = useKomorebiStore(selectGapless);
  const smartShuffle = useKomorebiStore(selectSmartShuffle);
  const autoPlayNext = useKomorebiStore(selectAutoPlayNext);
  const repeat = useKomorebiStore(selectRepeat);
  const shuffle = useKomorebiStore(selectShuffle);

  useEffect(() => {
    const engine = engineRef.current;
    const library = libraryRef.current;
    if (!engine || !library) return;

    const detachEngine = useKomorebiStore.getState().attachEngine(engine);

    const persistEngineSettings = () => {
      engineSettingsPersistence.save(engine.getState().settings);
    };
    engine.on("settingschange", persistEngineSettings);
    engine.on("volumechange", persistEngineSettings);

    const pushLibraryToStore = () => {
      useKomorebiStore.getState().setSongs([...library.getState().songs]);
    };
    library.on("songadded", pushLibraryToStore);
    library.on("songremoved", pushLibraryToStore);
    library.on("songupdated", pushLibraryToStore);
    library.on("playlistadded", pushLibraryToStore);
    library.on("playlistremoved", pushLibraryToStore);
    library.on("playlistupdated", pushLibraryToStore);
    library.on("playlistsupdated", pushLibraryToStore);
    library.on("favoritechanged", pushLibraryToStore);

    const mediaSession = createMediaSessionIntegration();
    const discord = createDiscordIntegration();
    void mediaSession.initialize();
    void discord.initialize();

    mediaSession.setActionHandlers({
      play: () => {
        void engine.play();
      },
      pause: () => engine.pause(),
      next: () => {
        void engine.next();
      },
      previous: () => {
        void engine.previous();
      },
      stop: () => engine.stop(),
      seek: (time) => engine.seek(time),
    });

    const syncMediaSession = () => {
      const engineState = engine.getState();
      mediaSession.setPlaybackState(
        engineState.state === "playing"
          ? "playing"
          : engineState.state === "paused"
            ? "paused"
            : "none",
      );
      if (engineState.duration > 0) {
        mediaSession.setPositionState(
          engineState.duration,
          engineState.currentTime,
          engineState.settings.tempo,
        );
      }
    };

    let discordActive = false;
    const updateDiscordPresence = (track: Track | null) => {
      const settings = settingsRef.current?.getSettings();
      const userId = settings?.discordUserId ?? null;
      const enabled = Boolean(settings?.discordEnabled);
      const shouldSync =
        enabled &&
        userId !== null &&
        DiscordService.isDiscordAvailable(userId) &&
        track !== null;

      if (shouldSync && userId) {
        discord.setUserId(userId);
        discordActive = true;
        void discord.updatePresence(
          track,
          engine.getState().state === "playing",
        );
      } else if (discordActive) {
        discordActive = false;
        void discord.clearPresence();
      }
    };

    const handleTrackChange = (data: { from: Track | null; to: Track | null }) => {
      void mediaSession.updateMetadata(data.to);
      syncMediaSession();
      updateDiscordPresence(data.to);
    };
    engine.on("trackchange", handleTrackChange);
    engine.on("statechange", syncMediaSession);
    engine.on("durationchange", syncMediaSession);

    const handleSettingsChange = (changes: Partial<SettingsState>) => {
      if (
        changes.discordEnabled !== undefined ||
        changes.discordUserId !== undefined
      ) {
        updateDiscordPresence(engine.getState().currentTrack);
      }
    };
    settingsRef.current?.on("settingschange", handleSettingsChange);

    const initialTrack = engine.getState().currentTrack;
    void mediaSession.updateMetadata(initialTrack);
    updateDiscordPresence(initialTrack);
    syncMediaSession();

    const loadLibrary = async () => {
      try {
        const savedLibrary = await libraryPersistence.loadFullLibrary();
        if (savedLibrary) {
          for (const song of savedLibrary.songs) {
            const reconstructed = await trackStorage.reconstructUrl(song);
            library.addSong(reconstructed);
          }
          library.seedPlaylists(savedLibrary.playlists);
          savedLibrary.favorites.forEach((id) => {
            const song = library.getSong(id);
            if (song) library.toggleFavorite(id);
          });
        }
      } catch (err) {
        logger.error("Failed to load library:", { error: String(err) });
      }
    };

    loadLibrary().then(() => {
      useKomorebiStore.getState().setReady(true);
      pushLibraryToStore();
    });

    return () => {
      detachEngine();
      library.off("songadded", pushLibraryToStore);
      library.off("songremoved", pushLibraryToStore);
      library.off("songupdated", pushLibraryToStore);
      library.off("playlistadded", pushLibraryToStore);
      library.off("playlistremoved", pushLibraryToStore);
      library.off("playlistupdated", pushLibraryToStore);
      library.off("playlistsupdated", pushLibraryToStore);
      library.off("favoritechanged", pushLibraryToStore);
      engine.off("settingschange", persistEngineSettings);
      engine.off("volumechange", persistEngineSettings);
      engine.off("trackchange", handleTrackChange);
      engine.off("statechange", syncMediaSession);
      engine.off("durationchange", syncMediaSession);
      settingsRef.current?.off("settingschange", handleSettingsChange);
      mediaSession.dispose();
      discord.dispose();
      backendRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!options.persistLibrary || !libraryRef.current || !isReady) return;

    const handleSongAdded = (song: Track) => {
      libraryPersistence.saveSong(song);
    };
    const handleSongRemoved = (songId: string) => {
      libraryPersistence.deleteSong(songId);
    };
    const handleFavoritesChange = () => {
      const library = libraryRef.current;
      if (library) {
        libraryPersistence.saveFavorites(library.getState().favorites);
      }
    };

    const handlePlaylistsChange = () => {
      if (playlistsSaveTimerRef.current !== null) {
        window.clearTimeout(playlistsSaveTimerRef.current);
      }
      playlistsSaveTimerRef.current = window.setTimeout(() => {
        playlistsSaveTimerRef.current = null;
        const current = libraryRef.current;
        if (current) {
          libraryPersistence
            .savePlaylists(current.getState().playlists)
            .catch((error: unknown) => {
              logger.error("Failed to save playlists:", {
                error: String(error),
              });
            });
        }
      }, 300);
    };

    const library = libraryRef.current;
    library.on(
      "songadded",
      handleSongAdded as Parameters<typeof library.on>[1],
    );
    library.on(
      "songremoved",
      handleSongRemoved as Parameters<typeof library.on>[1],
    );
    library.on(
      "favoritechanged",
      handleFavoritesChange as Parameters<typeof library.on>[1],
    );
    library.on(
      "playlistadded",
      handlePlaylistsChange as Parameters<typeof library.on>[1],
    );
    library.on(
      "playlistremoved",
      handlePlaylistsChange as Parameters<typeof library.on>[1],
    );
    library.on(
      "playlistupdated",
      handlePlaylistsChange as Parameters<typeof library.on>[1],
    );
    library.on(
      "playlistsupdated",
      handlePlaylistsChange as Parameters<typeof library.on>[1],
    );

    return () => {
      if (playlistsSaveTimerRef.current !== null) {
        window.clearTimeout(playlistsSaveTimerRef.current);
      }
      library.off(
        "songadded",
        handleSongAdded as Parameters<typeof library.on>[1],
      );
      library.off(
        "songremoved",
        handleSongRemoved as Parameters<typeof library.on>[1],
      );
      library.off(
        "favoritechanged",
        handleFavoritesChange as Parameters<typeof library.on>[1],
      );
      library.off(
        "playlistadded",
        handlePlaylistsChange as Parameters<typeof library.on>[1],
      );
      library.off(
        "playlistremoved",
        handlePlaylistsChange as Parameters<typeof library.on>[1],
      );
      library.off(
        "playlistupdated",
        handlePlaylistsChange as Parameters<typeof library.on>[1],
      );
      library.off(
        "playlistsupdated",
        handlePlaylistsChange as Parameters<typeof library.on>[1],
      );
    };
  }, [options.persistLibrary, isReady]);

  const play = useCallback(async () => {
    await engineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const togglePlayPause = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.getState().state === "playing") {
      engine.pause();
    } else {
      await engine.play();
    }
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const load = useCallback((track: Track, playlist?: Playlist) => {
    useKomorebiStore.getState().setError(null);
    engineRef.current?.load(track, playlist);
  }, []);

  const playSong = useCallback(async (song: Track, playlist?: Playlist) => {
    useKomorebiStore.getState().setError(null);
    const engine = engineRef.current;
    if (!engine) return;

    const trackToPlay = await trackStorage.reconstructUrl(song);

    if (playlist) {
      engine.setPlaylist(playlist);
    }
    engine.load(trackToPlay, playlist);

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        engine.off("ready", handleReady);
        engine.off("error", handleError);
        resolve();
      };
      const timeoutId = setTimeout(finish, LOAD_WAIT_TIMEOUT_MS);
      const handleReady = () => finish();
      const handleError = () => finish();

      engine.on("ready", handleReady);
      engine.on("error", handleError);
    });

    const playerState = engine.getState().state;
    if (playerState === "ready" || playerState === "paused") {
      await engine.play();
    }
  }, []);

  const seek = useCallback((time: number) => {
    engineRef.current?.seek(time);
  }, []);

  const next = useCallback(async () => {
    await engineRef.current?.next();
  }, []);

  const previous = useCallback(async () => {
    await engineRef.current?.previous();
  }, []);

  const setVolume = useCallback((volume: number) => {
    engineRef.current?.setVolume(volume);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    engineRef.current?.setTempo(rate);
  }, []);

  const setPitch = useCallback((semitones: number) => {
    engineRef.current?.setPitch(semitones);
  }, []);

  const setCrossfade = useCallback((duration: number) => {
    engineRef.current?.setCrossfade(duration);
  }, []);

  const setGapless = useCallback((enabled: boolean) => {
    engineRef.current?.setGapless(enabled);
  }, []);

  const setShuffle = useCallback((shuffled: boolean) => {
    engineRef.current?.setShuffle(shuffled);
  }, []);

  const setShuffleMode = useCallback((mode: "random" | "smart") => {
    engineRef.current?.setShuffleMode(mode);
  }, []);

  const setRepeat = useCallback((mode: "off" | "one" | "all") => {
    engineRef.current?.setRepeat(mode);
  }, []);

  const setAutoPlayNext = useCallback((enabled: boolean) => {
    engineRef.current?.setAutoPlayNext(enabled);
  }, []);

  const getAnalyser = useCallback(() => {
    return engineRef.current?.getAnalyser() ?? null;
  }, []);

  const getEqualizer = useCallback(() => {
    const backend = backendRef.current;
    return backend instanceof BackendRouter ? backend.getEqualizer() : null;
  }, []);

  const setEqualizerEnabled = useCallback((enabled: boolean) => {
    const backend = backendRef.current;
    if (backend instanceof BackendRouter) {
      backend.setEqualizer(enabled);
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    engineRef.current?.toggleShuffle();
  }, []);

  const toggleRepeat = useCallback(() => {
    engineRef.current?.toggleRepeat();
  }, []);

  const setPlaylist = useCallback((playlist: Playlist) => {
    engineRef.current?.setPlaylist(playlist);
  }, []);

  const getQueue = useCallback(() => {
    return engineRef.current?.getQueue().getTracks() ?? [];
  }, []);

  const addSong = useCallback((song: Track) => {
    libraryRef.current?.addSong(song);
  }, []);

  const removeSong = useCallback((songId: string) => {
    libraryRef.current?.removeSong(songId);
  }, []);

  const getSong = useCallback((songId: string) => {
    return libraryRef.current?.getSong(songId);
  }, []);

  const addPlaylist = useCallback((playlist: Playlist) => {
    libraryRef.current?.addPlaylist(playlist);
  }, []);

  const removePlaylist = useCallback((playlistId: string) => {
    libraryRef.current?.removePlaylist(playlistId);
  }, []);

  const getPlaylist = useCallback((playlistId: string) => {
    return libraryRef.current?.getPlaylist(playlistId);
  }, []);

  const toggleFavorite = useCallback((songId: string) => {
    libraryRef.current?.toggleFavorite(songId);
  }, []);

  const isFavorite = useCallback((songId: string) => {
    return libraryRef.current?.isFavorite(songId) ?? false;
  }, []);

  const getFavorites = useCallback(() => {
    return libraryRef.current?.getFavoriteSongs() ?? [];
  }, []);

  const search = useCallback((query: string) => {
    return libraryRef.current?.search(query) ?? [];
  }, []);

  const getSongsByArtist = useCallback((artist: string) => {
    return libraryRef.current?.getSongsByArtist(artist) ?? [];
  }, []);

  const getSongsByAlbum = useCallback((album: string) => {
    return libraryRef.current?.getSongsByAlbum(album) ?? [];
  }, []);

  return {
    engine: engineRef.current!,
    library: libraryRef.current!,
    settings: settingsRef.current!,

    isReady,
    isLoading,

    state,
    songs,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    tempo,
    pitch,
    crossfade,
    gapless,
    smartShuffle,
    autoPlayNext,
    repeat,
    shuffle,
    error,

    play,
    pause,
    togglePlayPause,
    stop,
    seek,
    next,
    previous,
    setVolume,
    setPlaybackRate,
    setPitch,
    setCrossfade,
    setGapless,
    setShuffle,
    setShuffleMode,
    setRepeat,
    setAutoPlayNext,
    getAnalyser,
    getEqualizer,
    setEqualizerEnabled,
    toggleShuffle,
    toggleRepeat,

    load,
    playSong,
    setPlaylist,
    getQueue,

    addSong,
    removeSong,
    getSong,

    addPlaylist,
    removePlaylist,
    getPlaylist,

    toggleFavorite,
    isFavorite,
    getFavorites,

    search,
    getSongsByArtist,
    getSongsByAlbum,
  };
}

export default useKomorebi;
