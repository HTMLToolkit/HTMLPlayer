import { useEffect, useRef, useState, useCallback } from "react";
import { KomorebiEngine } from "../core/engine/engine";
import type {
  Track,
  Playlist,
  PlaylistFolder,
  EngineState,
  QueueState,
} from "../core/engine/types";
import type { IAudioBackend } from "../platform/audio";
import { HTMLAudioBackend } from "../platform/audio/backends/HTMLBackend";
import { LibraryManager } from "../platform/library/library";
import { libraryPersistence } from "../platform/library/persistence";
import { trackStorage } from "../platform/storage/trackStorage";
import { SettingsManager } from "../platform/settings/settings";
import { createLogger } from "../helpers/logger";

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

const DEFAULT_QUEUE: QueueState = {
  tracks: [],
  currentIndex: -1,
  shuffled: false,
  shuffleOrder: [],
};

function createInitialState(): EngineState {
  return {
    state: "idle",
    currentTrack: null,
    currentPlaylist: null,
    queue: DEFAULT_QUEUE,
    settings: {
      volume: 1,
      crossfade: 0,
      crossfadeBeforeGapless: 3000,
      autoPlayNext: true,
      tempo: 1,
      pitch: 0,
      gaplessPlayback: true,
      smartShuffle: false,
      repeat: "off",
      defaultShuffle: false,
      defaultRepeat: "off",
    },
    currentTime: 0,
    duration: 0,
    volume: 1,
    playHistory: new Map(),
    error: null,
  };
}

export function useKomorebi(
  options: UseKomorebiOptions = {},
): UseKomorebiReturn {
  const backendRef = useRef<IAudioBackend | null>(null);
  const engineRef = useRef<KomorebiEngine | null>(null);
  const libraryRef = useRef<LibraryManager | null>(null);
  const settingsRef = useRef<SettingsManager | null>(null);
  const initializedRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<EngineState>(createInitialState);
  const [songs, setSongs] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  useEffect(() => {
    const engine = engineRef.current;
    const library = libraryRef.current;
    if (!engine || !library) return;

    const handleStateChange = () => {
      setState(engine.getState());
    };
    const handleTrackChange = (e: { from: Track | null; to: Track | null }) => {
      setCurrentTrack(e.to);
    };
    const handleTimeUpdate = (e: { currentTime: number; duration: number }) => {
      setCurrentTime(e.currentTime);
      setDuration(e.duration);
    };
    const handleEnded = async () => {
      const currentState = engine.getState();
      if (currentState.settings.autoPlayNext) {
        await engine.next();
      }
    };
    const handleError = (e: { error: { message: string } }) => {
      setError(e.error.message);
    };
    const handleLoading = () => setIsLoading(true);
    const handleReady = () => setIsLoading(false);

    engine.on("statechange", handleStateChange);
    engine.on("trackchange", handleTrackChange);
    engine.on("timeupdate", handleTimeUpdate);
    engine.on("ended", handleEnded);
    engine.on("error", handleError);
    engine.on("loading", handleLoading);
    engine.on("ready", handleReady);

    const handleLibraryChange = () => {
      console.log("[handleLibraryChange] called, songs:", library.getState().songs.length);
      setSongs([...library.getState().songs]);
      setState(engine.getState());
    };
    library.on("songadded", handleLibraryChange);
    library.on("songremoved", handleLibraryChange);
    library.on("playlistadded", handleLibraryChange);
    library.on("playlistremoved", handleLibraryChange);
    library.on("favoritechanged", handleLibraryChange);

    const loadLibrary = async () => {
      try {
        const savedLibrary = await libraryPersistence.loadFullLibrary();
        if (savedLibrary) {
          for (const song of savedLibrary.songs) {
            const reconstructed = await trackStorage.reconstructUrl(song);
            library.addSong(reconstructed);
          }
          savedLibrary.playlists.forEach((playlist) => {
            if ("songs" in playlist) {
              library.addPlaylist(playlist);
            }
          });
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
      setIsReady(true);
      console.log("[loadLibrary] setting songs:", library.getState().songs.length);
      setSongs([...library.getState().songs]);
      setState(engine.getState());
    });

    return () => {
      engine.off("statechange", handleStateChange);
      engine.off("trackchange", handleTrackChange);
      engine.off("timeupdate", handleTimeUpdate);
      engine.off("ended", handleEnded);
      engine.off("error", handleError);
      engine.off("loading", handleLoading);
      engine.off("ready", handleReady);
      library.off("songadded", handleLibraryChange);
      library.off("songremoved", handleLibraryChange);
      library.off("playlistadded", handleLibraryChange);
      library.off("playlistremoved", handleLibraryChange);
      library.off("favoritechanged", handleLibraryChange);
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

    return () => {
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
    setError(null);
    engineRef.current?.load(track, playlist);
  }, []);

  const playSong = useCallback(async (song: Track, playlist?: Playlist) => {
    console.log("[playSong] called", { song: song?.title, songUrl: song?.url, playlist: playlist?.name });
    setError(null);
    const engine = engineRef.current;
    console.log("[playSong] engine:", engine);
    if (!engine) {
      console.log("[playSong] no engine!");
      return;
    }

    const trackToPlay = await trackStorage.reconstructUrl(song);
    console.log("[playSong] reconstructed url:", trackToPlay.url);

    if (playlist) {
      engine.setPlaylist(playlist);
    }
    engine.load(trackToPlay, playlist);
    
    await new Promise<void>((resolve) => {
      const handleReady = () => {
        engine.off("ready", handleReady);
        resolve();
      };
      engine.on("ready", handleReady);
    });
    
    console.log("[playSong] calling engine.play()");
    await engine.play();
    console.log("[playSong] play() completed");
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
    console.log("[addSong] called", { songId: song.id, title: song.title });
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
    isPlaying: state.state === "playing",
    currentTime,
    duration,
    volume: state.settings.volume,
    repeat: state.settings.repeat,
    shuffle: state.queue.shuffled,
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
