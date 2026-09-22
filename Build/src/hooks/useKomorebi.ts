import { useEffect, useRef, useCallback } from "react";
import { KomorebiEngine } from "../core/engine/engine";
import type {
  Track,
  Playlist,
  PlaylistFolder,
  EngineState,
} from "../core/engine/types";
import type { IAudioBackend } from "../platform/audio";
import { HTMLAudioBackend } from "../platform/audio/backends/HTMLBackend";
import { LibraryManager } from "../platform/library/library";
import { libraryPersistence } from "../platform/library/persistence";
import { trackStorage } from "../platform/storage/trackStorage";
import { SettingsManager } from "../platform/settings/settings";
import { createLogger } from "../helpers/logger";
import {
  useKomorebiStore,
  EMPTY_ENGINE_STATE,
  selectCurrentTrack,
  selectCurrentTime,
  selectDuration,
  selectError,
  selectIsLoading,
  selectIsPlaying,
  selectIsReady,
  selectRepeat,
  selectShuffle,
  selectSnapshot,
  selectSongs,
  selectVolume,
} from "../store";

const logger = createLogger("useKomorebi");

export interface UseKomorebiOptions {
  autoPlay?: boolean;
  persistLibrary?: boolean;
  persistSettings?: boolean;
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
    const backend = new HTMLAudioBackend();
    const engine = new KomorebiEngine({
      crossfade: { enabled: false, duration: 0, shape: "linear" },
      gapless: { enabled: true },
      smartShuffle: true,
      autoPlayNext: options.autoPlay ?? false,
    });
    engine.setBackend(backend);
    engineRef.current = engine;
    backendRef.current = backend;

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
  const repeat = useKomorebiStore(selectRepeat);
  const shuffle = useKomorebiStore(selectShuffle);

  useEffect(() => {
    const engine = engineRef.current;
    const library = libraryRef.current;
    if (!engine || !library) return;

    const detachEngine = useKomorebiStore.getState().attachEngine(engine);

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
              logger.error("Failed to save playlists:", { error: String(error) });
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
    settingsRef.current?.setVolume(volume);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    engineRef.current?.setTempo(rate);
    settingsRef.current?.setTempo(rate);
  }, []);

  const setPitch = useCallback((semitones: number) => {
    engineRef.current?.setPitch(semitones);
    settingsRef.current?.setPitch(semitones);
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