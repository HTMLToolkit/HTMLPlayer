import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { musicIndexedDbHelper } from "./musicIndexedDbHelper";

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

export type PlayerSettings = {
  volume: number;
  audioQuality: "low" | "medium" | "high" | "lossless";
  crossfade: number;
  defaultShuffle: boolean;
  defaultRepeat: "off" | "one" | "all";
  themeMode: "light" | "dark" | "auto";
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
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const songCacheRef = useRef<Map<string, CachedSong>>(new Map());

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
    audioQuality: "high",
    crossfade: 3,
    defaultShuffle: false,
    defaultRepeat: "off",
    autoPlayNext: true,
    themeMode: "auto",
    compactMode: false,
    showAlbumArt: true,
    showLyrics: false,
    lastPlayedSongId: "none",
    lastPlayedPlaylistId: "none",
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

          // Default to All Songs playlist if none set or if last played playlist doesn't exist
          if (
            !playlistToSet ||
            !playlistToSet.songs ||
            playlistToSet.songs.length === 0
          ) {
            playlistToSet = allSongsPlaylist;
          }

          // If no song set but we have songs, play the first one from the current playlist
          if (!songToPlay && playlistToSet.songs.length > 0) {
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

      if (!sourceNodeRef.current) {
        sourceNodeRef.current = context.createMediaElementSource(
          audioRef.current
        );
      }

      sourceNodeRef.current.connect(analyser);
      analyser.connect(context.destination);

      audioContextRef.current = context;
      setPlayerState((prev) => ({ ...prev, analyserNode: analyser }));
    }
  }, []);

  // Cleanup cache on unmount
  useEffect(() => {
    return () => {
      // Revoke all object URLs and clear the cache
      for (const [, cached] of songCacheRef.current.entries()) {
        URL.revokeObjectURL(cached.url);
      }
      songCacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.controls = true; // Enable browser controls

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
        if (playerStateRef.current.repeat === "one") {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          }
        } else if (playNextRef.current) {
          playNextRef.current();
        }
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
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
    setSettings((prev) => ({
      ...prev,
      lastPlayedSongId: playerState.currentSong?.id ?? prev.lastPlayedSongId,
      lastPlayedPlaylistId:
        playerState.currentPlaylist?.id ?? prev.lastPlayedPlaylistId,
    }));

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

      return () => {
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
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
        // Use the cached URL instead of the original URL
        audioRef.current.src = cachedSong.url;
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

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !playerState.currentSong) return;
    if (audioContextRef.current?.state === "suspended") {
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
    if (audioRef.current) audioRef.current.volume = clamped;
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

  // Batch size for processing songs
  const BATCH_SIZE = 7; // Process 7 songs at a time

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
      }

      // Finally, update player state to ensure UI reflects the change
      const allSongsPlaylist = library.playlists.find(
        (p) => p.id === "all-songs"
      );
      if (allSongsPlaylist) {
        setPlayerState((prevState) => ({
          ...prevState,
          currentPlaylist: allSongsPlaylist,
        }));
      }
    },
    [processAudioBatch, prepareSongsForPlaylist, library]
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

      // Finally, update player state to ensure UI reflects the change
      const allSongsPlaylist = library.playlists.find(
        (p) => p.id === "all-songs"
      );
      if (allSongsPlaylist) {
        setPlayerState((prevState) => ({
          ...prevState,
          currentPlaylist: allSongsPlaylist,
        }));
      }
    },
    [library, prepareSongsForPlaylist]
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
