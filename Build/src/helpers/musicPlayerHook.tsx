import { useState, useRef, useEffect, useCallback } from 'react';
import { musicIndexedDbHelper } from './musicIndexedDbHelper';

export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  url: string;
  fileData?: ArrayBuffer; // Store actual file data for persistence
  mimeType?: string; // Store MIME type for blob recreation
};

export type Playlist = {
  id: string;
  name: string;
  songs: Song[];
};

export type PlayerSettings = {
  volume: number; // 0 to 1
  audioQuality: 'low' | 'medium' | 'high' | 'lossless';
  crossfade: number; // seconds
  defaultShuffle: boolean;
  defaultRepeat: 'off' | 'one' | 'all';
  autoPlayNext: boolean;
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
};

export type PlayerState = {
  currentSong: Song | null;
  currentPlaylist: Playlist | null;
  isPlaying: boolean;
  volume: number; // 0 to 1
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
  analyserNode: AnalyserNode | null;
};

export type MusicLibrary = {
  songs: Song[];
  playlists: Playlist[];
  favorites: string[]; // song IDs
};



export const useMusicPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs to store current values for event handlers to avoid stale closures
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
    compactMode: false,
    showAlbumArt: true,
    showLyrics: false,
  });

  const [library, setLibrary] = useState<MusicLibrary>({
    songs: [],
    playlists: [],
    favorites: [],
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Refs to store current values for event handlers to avoid stale closures
  const settingsRef = useRef(settings);
  const playerStateRef = useRef(playerState);
  const libraryRef = useRef(library);

  // Load data from IndexedDB on initialization
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        console.log('Loading persisted data from IndexedDB...');
        
        // Load library data
        const persistedLibrary = await musicIndexedDbHelper.loadLibrary();
        if (persistedLibrary) {
          // Filter out any songs that couldn't have their URLs recreated
          const validLibrary = {
            ...persistedLibrary,
            songs: persistedLibrary.songs.filter((song: Song) => song.url && song.url !== '')
          };
          
          setLibrary(validLibrary);
          console.log('Restored library from IndexedDB:', validLibrary);
          
          // Log how many songs were restored vs failed
          const failedCount = persistedLibrary.songs.length - validLibrary.songs.length;
          if (failedCount > 0) {
            console.warn(`${failedCount} songs could not be restored due to invalid file data`);
          }
        }

        // Load settings
        const persistedSettings = await musicIndexedDbHelper.loadSettings();
        if (persistedSettings) {
          setSettings(persistedSettings);
          console.log('Restored settings from IndexedDB:', persistedSettings);
        }
      } catch (error) {
        console.error('Failed to load persisted data:', error);
        // Continue with default values on error
      } finally {
        setIsInitialized(true);
      }
    };

    loadPersistedData();
  }, []);

  // Save library data to IndexedDB whenever it changes
  useEffect(() => {
    if (!isInitialized) return;
    
    const saveLibrary = async () => {
      try {
        await musicIndexedDbHelper.saveLibrary(library);
      } catch (error) {
        console.error('Failed to persist library data:', error);
      }
    };

    // Debounce the save operation to avoid excessive saves during rapid changes
    const timeoutId = setTimeout(saveLibrary, 500);
    return () => clearTimeout(timeoutId);
  }, [library, isInitialized]);

  // Save settings to IndexedDB whenever they change
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
      console.log('Setting up AudioContext and AnalyserNode...');
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;

      // Ensure source is created only once
      if (!sourceNodeRef.current) {
        sourceNodeRef.current = context.createMediaElementSource(audioRef.current);
      }
      
      sourceNodeRef.current.connect(analyser);
      analyser.connect(context.destination);

      audioContextRef.current = context;
      setPlayerState(prev => ({ ...prev, analyserNode: analyser }));
    }
  }, []);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audio.currentTime,
      }));
    };

    const handleLoadedMetadata = () => {
      setPlayerState(prev => ({
        ...prev,
        duration: audio.duration,
      }));
    };

  const handleEnded = () => {
    console.log('🎵 Audio ended event fired');
    console.log('🎵 Current auto-play settings:', {
      autoPlayNext: settingsRef.current.autoPlayNext,
      repeat: playerStateRef.current.repeat,
      currentSong: playerStateRef.current.currentSong?.title,
      currentPlaylist: playerStateRef.current.currentPlaylist?.name,
      playlistSongCount: playerStateRef.current.currentPlaylist?.songs.length,
    });
    
    if (settingsRef.current.autoPlayNext) {
      console.log('🎵 Auto-play is enabled, checking repeat mode...');
      
      if (playerStateRef.current.repeat === 'one') {
        console.log('🎵 Repeat mode is "one", replaying current song');
        // Replay current song
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        }
      } else {
        console.log('🎵 Calling playNext() for auto-play');
        if (playNextRef.current) {
          playNextRef.current();
        }
      }
    } else {
      console.log('🎵 Auto-play is disabled, not playing next song');
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

  // Update refs when values change to avoid stale closures
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  // Update volume when settings change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  // Sync settings with player state
  useEffect(() => {
    setPlayerState(prev => ({
      ...prev,
      volume: settings.volume,
      shuffle: settings.defaultShuffle,
      repeat: settings.defaultRepeat,
    }));
  }, [settings.volume, settings.defaultShuffle, settings.defaultRepeat]);

  const playSong = useCallback((song: Song, playlist?: Playlist) => {
    console.log('Playing song:', song.title);
    
    if (!song.url || song.url === '') {
      console.error('Cannot play song: invalid or missing URL', song.title);
      return;
    }

    if (!audioContextRef.current) {
      setupAudioContext();
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    setPlayerState(prev => ({
      ...prev,
      currentSong: song,
      currentPlaylist: playlist || prev.currentPlaylist,
      isPlaying: true,
      currentTime: 0,
    }));

    if (audioRef.current) {
      audioRef.current.src = song.url;
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        if (error.name === 'NotSupportedError' && song.fileData && song.mimeType) {
          console.log('Attempting to recreate blob URL for playback...');
          try {
            const blob = new Blob([song.fileData], { type: song.mimeType });
            const newUrl = URL.createObjectURL(blob);
            
            const updatedSong = { ...song, url: newUrl };
            setPlayerState(prev => ({ ...prev, currentSong: updatedSong }));
            
            setLibrary(prev => ({
              ...prev,
              songs: prev.songs.map(s => s.id === song.id ? updatedSong : s)
            }));
            
            audioRef.current!.src = newUrl;
            audioRef.current!.play().catch(retryError => {
              console.error('Failed to play song even after URL recreation:', retryError);
              setPlayerState(prev => ({ ...prev, isPlaying: false }));
            });
          } catch (recreationError) {
            console.error('Failed to recreate blob URL:', recreationError);
            setPlayerState(prev => ({ ...prev, isPlaying: false }));
          }
        } else {
          setPlayerState(prev => ({ ...prev, isPlaying: false }));
        }
      });
    }
  }, [setupAudioContext]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !playerState.currentSong) return;

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      });
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [playerState.isPlaying, playerState.currentSong]);

  const playNext = useCallback(() => {
    console.log('🎵 playNext() called');
    console.log('🎵 Current playlist state:', {
      hasPlaylist: !!playerState.currentPlaylist,
      playlistName: playerState.currentPlaylist?.name,
      songCount: playerState.currentPlaylist?.songs.length,
      currentSong: playerState.currentSong?.title,
      shuffle: playerState.shuffle,
      repeat: playerState.repeat,
    });

    if (!playerState.currentPlaylist || !playerState.currentSong) {
      console.log('🎵 No playlist or current song available, cannot play next');
      return;
    }

    const songs = playerState.currentPlaylist.songs;
    let currentIndex = songs.findIndex(song => song.id === playerState.currentSong!.id);
    
    console.log('🎵 Current song index in playlist:', currentIndex, 'of', songs.length);
    
    if (playerState.shuffle) {
      console.log('🎵 Shuffle is enabled, selecting random song');
      const availableSongs = songs.filter(song => song.id !== playerState.currentSong!.id);
      console.log('🎵 Available songs for shuffle:', availableSongs.length);
      
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        const nextSong = availableSongs[randomIndex];
        console.log('🎵 Playing random song:', nextSong.title);
        playSong(nextSong, playerState.currentPlaylist);
      } else {
        console.log('🎵 No available songs for shuffle');
      }
    } else {
      console.log('🎵 Sequential playback mode');
      if (currentIndex < songs.length - 1) {
        const nextSong = songs[currentIndex + 1];
        console.log('🎵 Playing next song in sequence:', nextSong.title);
        playSong(nextSong, playerState.currentPlaylist);
      } else if (playerState.repeat === 'all') {
        console.log('🎵 End of playlist reached, repeat mode is "all", playing first song');
        playSong(songs[0], playerState.currentPlaylist);
      } else {
        console.log('🎵 End of playlist reached, no repeat, stopping playback');
      }
    }
  }, [playerState.currentPlaylist, playerState.currentSong, playerState.shuffle, playerState.repeat, playSong]);

  // Update playNext ref to avoid stale closures in event handlers
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const playPrevious = useCallback(() => {
    console.log('🎵 playPrevious() called');
    
    if (!playerState.currentPlaylist || !playerState.currentSong) {
      console.log('🎵 No playlist or current song available, cannot play previous');
      return;
    }

    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(song => song.id === playerState.currentSong!.id);
    
    console.log('🎵 Current song index in playlist:', currentIndex, 'of', songs.length);
    
    if (playerState.shuffle) {
      console.log('🎵 Shuffle is enabled, selecting random song for previous');
      const availableSongs = songs.filter(song => song.id !== playerState.currentSong!.id);
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        const prevSong = availableSongs[randomIndex];
        console.log('🎵 Playing random previous song:', prevSong.title);
        playSong(prevSong, playerState.currentPlaylist);
      } else {
        console.log('🎵 No available songs for shuffle previous');
      }
    } else {
      console.log('🎵 Sequential playback mode for previous');
      if (currentIndex > 0) {
        const previousSong = songs[currentIndex - 1];
        console.log('🎵 Playing previous song in sequence:', previousSong.title);
        playSong(previousSong, playerState.currentPlaylist);
      } else if (playerState.repeat === 'all') {
        console.log('🎵 At beginning of playlist, repeat mode is "all", playing last song');
        playSong(songs[songs.length - 1], playerState.currentPlaylist);
      } else {
        console.log('🎵 At beginning of playlist, no repeat, cannot go to previous');
      }
    }
  }, [playerState.currentPlaylist, playerState.currentSong, playerState.shuffle, playerState.repeat, playSong]);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setSettings(prev => ({ ...prev, volume: clampedVolume }));
    
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayerState(prev => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      repeat: prev.repeat === 'off' ? 'all' : prev.repeat === 'all' ? 'one' : 'off'
    }));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<PlayerSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = time;
    setPlayerState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const addSong = useCallback(async (song: Song) => {
    let songWithData = song;
    if (song.url.startsWith('blob:') && !song.fileData) {
      try {
        const response = await fetch(song.url);
        const arrayBuffer = await response.arrayBuffer();
        songWithData = {
          ...song,
          fileData: arrayBuffer,
          mimeType: response.headers.get('content-type') || 'audio/mpeg'
        };
        console.log('Stored file data for song:', song.title);
      } catch (error) {
        console.warn('Failed to store file data for song:', song.title, error);
      }
    }
    
    setLibrary(prev => ({
      ...prev,
      songs: [...prev.songs, songWithData],
    }));
    console.log('Added song to library:', song.title);
  }, []);

  const removeSong = useCallback((songId: string) => {
    setLibrary(prev => ({
      ...prev,
      songs: prev.songs.filter(song => song.id !== songId),
      playlists: prev.playlists.map(playlist => ({
        ...playlist,
        songs: playlist.songs.filter(song => song.id !== songId),
      })),
      favorites: prev.favorites.filter(id => id !== songId),
    }));
    console.log('Removed song from library:', songId);
  }, []);

  const createPlaylist = useCallback((name: string, songs: Song[] = []) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      songs,
    };
    
    setLibrary(prev => ({
      ...prev,
      playlists: [...prev.playlists, newPlaylist],
    }));
    
    console.log('Created playlist:', name);
    return newPlaylist;
  }, []);

  const removePlaylist = useCallback((playlistId: string) => {
    setLibrary(prev => ({
      ...prev,
      playlists: prev.playlists.filter(playlist => playlist.id !== playlistId),
    }));
    console.log('Removed playlist:', playlistId);
  }, []);

  const addToFavorites = useCallback((songId: string) => {
    setLibrary(prev => ({
      ...prev,
      favorites: prev.favorites.includes(songId) 
        ? prev.favorites 
        : [...prev.favorites, songId],
    }));
    console.log('Added to favorites:', songId);
  }, []);

  const removeFromFavorites = useCallback((songId: string) => {
    setLibrary(prev => ({
      ...prev,
      favorites: prev.favorites.filter(id => id !== songId),
    }));
    console.log('Removed from favorites:', songId);
  }, []);

  const toggleFavorite = useCallback((songId: string) => {
    const isFavorited = library.favorites.includes(songId);
    if (isFavorited) {
      removeFromFavorites(songId);
    } else {
      addToFavorites(songId);
    }
    return !isFavorited;
  }, [library.favorites, addToFavorites, removeFromFavorites]);

  const isFavorited = useCallback((songId: string) => {
    return library.favorites.includes(songId);
  }, [library.favorites]);

  const getFavoriteSongs = useCallback(() => {
    return library.songs.filter(song => library.favorites.includes(song.id));
  }, [library.songs, library.favorites]);

  const searchSongs = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return library.songs;
    
    return library.songs.filter(song =>
      song.title.toLowerCase().includes(query.toLowerCase()) ||
      song.artist.toLowerCase().includes(query.toLowerCase())
    );
  }, [library.songs]);

  const getSearchResults = useCallback(() => {
    return searchSongs(searchQuery);
  }, [searchSongs, searchQuery]);

  return {
    playerState,
    library,
    searchQuery,
    settings,
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