import { useState, useRef, useEffect, useCallback } from 'react';
import { musicIndexedDbHelper } from './musicIndexedDbHelper';

export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  fileData?: ArrayBuffer;
  mimeType?: string;
};

export type Playlist = {
  id: string;
  name: string;
  songs: Song[];
};

export type PlayerSettings = {
  volume: number;
  audioQuality: 'low' | 'medium' | 'high' | 'lossless';
  crossfade: number;
  defaultShuffle: boolean;
  defaultRepeat: 'off' | 'one' | 'all';
  themeMode: 'light' | 'dark' | 'auto';
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
  repeat: 'off' | 'one' | 'all';
  analyserNode: AnalyserNode | null;
};

export type MusicLibrary = {
  songs: Song[];
  playlists: Playlist[];
  favorites: string[];
};

export const useMusicPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

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
    repeat: 'off',
    analyserNode: null,
  });

  const [settings, setSettings] = useState<PlayerSettings>({
    volume: 0.75,
    audioQuality: 'high',
    crossfade: 3,
    defaultShuffle: false,
    defaultRepeat: 'off',
    autoPlayNext: true,
    themeMode: 'auto',
    compactMode: false,
    showAlbumArt: true,
    showLyrics: false,
    lastPlayedSongId: 'none',
    lastPlayedPlaylistId: 'none',
  });

  const [library, setLibrary] = useState<MusicLibrary>({
    songs: [],
    playlists: [],
    favorites: [],
  });

  const [searchQuery, setSearchQuery] = useState('');

  const settingsRef = useRef(settings);
  const playerStateRef = useRef(playerState);
  const libraryRef = useRef(library);

  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const persistedLibrary = await musicIndexedDbHelper.loadLibrary();
        const persistedSettings = await musicIndexedDbHelper.loadSettings();

        if (persistedLibrary) {
          const validLibrary = {
            ...persistedLibrary,
            songs: persistedLibrary.songs.filter((song: Song) => song.url && song.url !== ''),
          };
          setLibrary(validLibrary);

          let songToPlay: Song | null = null;
          let playlistToSet: Playlist | null = null;

          if (persistedSettings?.lastPlayedSongId) {
            songToPlay = validLibrary.songs.find(s => s.id === persistedSettings.lastPlayedSongId) || null;
          }
          if (persistedSettings?.lastPlayedPlaylistId) {
            playlistToSet = validLibrary.playlists.find(p => p.id === persistedSettings.lastPlayedPlaylistId) || null;
          }

          if (!songToPlay && validLibrary.songs.length > 0) {
            songToPlay = validLibrary.songs[0];
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
        console.error('Failed to load persisted data:', error);
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
        console.error('Failed to persist library data:', error);
      }
    };
    const timeoutId = setTimeout(saveLibrary, 500);
    return () => clearTimeout(timeoutId);
  }, [library, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const saveSettings = async () => {
      try {
        await musicIndexedDbHelper.saveSettings(settings);
      } catch (error) {
        console.error('Failed to persist settings:', error);
      }
    };
    saveSettings();
  }, [settings, isInitialized]);

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
      setPlayerState((prev) => ({ ...prev, analyserNode: analyser }));
    }
  }, []);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setPlayerState((prev) => ({
        ...prev,
        currentTime: audio.currentTime,
      }));
    };

    const handleLoadedMetadata = () => {
      setPlayerState((prev) => ({
        ...prev,
        duration: audio.duration,
      }));
    };

    const handleEnded = () => {
      if (settingsRef.current.autoPlayNext) {
        if (playerStateRef.current.repeat === 'one') {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          }
        } else if (playNextRef.current) {
          playNextRef.current();
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
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
    // Update last played song and playlist IDs in settings when they change
    setSettings(prev => ({
      ...prev,
      lastPlayedSongId: playerState.currentSong?.id ?? prev.lastPlayedSongId,
      lastPlayedPlaylistId: playerState.currentPlaylist?.id ?? prev.lastPlayedPlaylistId,
    }));
  }, [playerState.currentSong, playerState.currentPlaylist, isInitialized]);


  const playSong = useCallback(
    (song: Song, playlist?: Playlist) => {
      if (!song.url || song.url === '') return;
      if (!audioContextRef.current) setupAudioContext();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }

      setPlayerState((prev) => ({
        ...prev,
        currentSong: song,
        currentPlaylist: playlist || prev.currentPlaylist,
        isPlaying: true,
        currentTime: 0,
      }));

      if (audioRef.current) {
        audioRef.current.src = song.url;
        audioRef.current.play().catch(async (error) => {
          if (error.name === 'NotSupportedError' && song.fileData && song.mimeType) {
            try {
              const blob = new Blob([song.fileData], { type: song.mimeType });
              const newUrl = URL.createObjectURL(blob);
              const updatedSong = { ...song, url: newUrl };

              setPlayerState((prev) => ({ ...prev, currentSong: updatedSong }));
              setLibrary((prev) => ({
                ...prev,
                songs: prev.songs.map((s) => (s.id === song.id ? updatedSong : s)),
              }));

              audioRef.current!.src = newUrl;
              await audioRef.current!.play();
            } catch {
              setPlayerState((prev) => ({ ...prev, isPlaying: false }));
            }
          } else {
            setPlayerState((prev) => ({ ...prev, isPlaying: false }));
          }
        });
      }
    },
    [setupAudioContext]
  );

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !playerState.currentSong) return;
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current
        .play()
        .catch(() => setPlayerState((prev) => ({ ...prev, isPlaying: false })));
      setPlayerState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [playerState.isPlaying, playerState.currentSong]);

  const playNext = useCallback(() => {
    if (!playerState.currentPlaylist || !playerState.currentSong) return;
    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex((s) => s.id === playerState.currentSong!.id);

    if (playerState.shuffle) {
      const available = songs.filter((s) => s.id !== playerState.currentSong!.id);
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        playSong(available[randomIndex], playerState.currentPlaylist);
      }
    } else {
      if (currentIndex < songs.length - 1) {
        playSong(songs[currentIndex + 1], playerState.currentPlaylist);
      } else if (playerState.repeat === 'all') {
        playSong(songs[0], playerState.currentPlaylist);
      }
    }
  }, [playerState, playSong]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const playPrevious = useCallback(() => {
    if (!playerState.currentPlaylist || !playerState.currentSong) return;
    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex((s) => s.id === playerState.currentSong!.id);

    if (playerState.shuffle) {
      const available = songs.filter((s) => s.id !== playerState.currentSong!.id);
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        playSong(available[randomIndex], playerState.currentPlaylist);
      }
    } else {
      if (currentIndex > 0) {
        playSong(songs[currentIndex - 1], playerState.currentPlaylist);
      } else if (playerState.repeat === 'all') {
        playSong(songs[songs.length - 1], playerState.currentPlaylist);
      }
    }
  }, [playerState, playSong]);

  const setVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setSettings((prev) => ({ ...prev, volume: clamped }));
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayerState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setPlayerState((prev) => ({
      ...prev,
      repeat: prev.repeat === 'off' ? 'all' : prev.repeat === 'all' ? 'one' : 'off',
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

  const addSong = useCallback(async (song: Song) => {
    let songWithData = song;
    if (song.url.startsWith('blob:') && !song.fileData) {
      try {
        const res = await fetch(song.url);
        const buf = await res.arrayBuffer();
        songWithData = { ...song, fileData: buf, mimeType: res.headers.get('content-type') || 'audio/mpeg' };
      } catch {}
    }
    setLibrary((prev) => ({ ...prev, songs: [...prev.songs, songWithData] }));
  }, []);

  const removeSong = useCallback((songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      songs: prev.songs.filter((s) => s.id !== songId),
      playlists: prev.playlists.map((p) => ({
        ...p,
        songs: p.songs.filter((s) => s.id !== songId),
      })),
      favorites: prev.favorites.filter((id) => id !== songId),
    }));
  }, []);

  const createPlaylist = useCallback((name: string, songs: Song[] = []) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      songs,
    };
    setLibrary((prev) => ({ ...prev, playlists: [...prev.playlists, newPlaylist] }));
    return newPlaylist;
  }, []);

  const removePlaylist = useCallback((playlistId: string) => {
    setLibrary((prev) => ({
      ...prev,
      playlists: prev.playlists.filter((p) => p.id !== playlistId),
    }));
  }, []);

  const addToFavorites = useCallback((songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(songId) ? prev.favorites : [...prev.favorites, songId],
    }));
  }, []);

  const removeFromFavorites = useCallback((songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      favorites: prev.favorites.filter((id) => id !== songId),
    }));
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
    return library.songs.filter((s) => library.favorites.includes(s.id));
  }, [library]);

  const searchSongs = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return library.songs;
    return library.songs.filter(
      (s) =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase())
    );
  }, [library.songs]);

  const getSearchResults = useCallback(() => {
    return searchSongs(searchQuery);
  }, [searchSongs, searchQuery]);

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
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorited,
    getFavoriteSongs,
    searchSongs,
    getSearchResults,
    setSearchQuery,
  };
};
