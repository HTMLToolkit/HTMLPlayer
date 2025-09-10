import { useCallback, useEffect, useRef } from "react";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { Playlist } from "../types/Playlist";
import { Song } from "../types/Song";

export const useSongCache = () => {
  console.log("useSongCache: Instantiated");

  const songCacheRef = useRef<Map<string, CachedSong>>(new Map());
  const lastPreparedSongsRef = useRef<{ input: Song[]; output: Song[] } | null>(null);

  // Type for cached song
  type CachedSong = {
    song: Song;
    audioBuffer: ArrayBuffer;
    url: string;
    loadedAt: number;
  };

  // Cache configuration - use ref to avoid dependency issues
  const CACHE_CONFIG = useRef({
    PREV_SONGS: 2, // Number of previous songs to cache
    NEXT_SONGS: 3, // Number of next songs to cache
    CACHE_EXPIRY: 5 * 60 * 1000, // 5 minutes in milliseconds
  });

  // Cache management functions
  const cacheSong = useCallback(async (song: Song) => {
    console.log("useSongCache: cacheSong called", { songId: song.id });
    
    if (!song || !song.id) {
      console.error("useSongCache: Invalid song provided to cacheSong");
      return;
    }
    
    // Check if song is already cached by ID
    if (songCacheRef.current.has(song.id)) {
      // Update the cached song's URL if it's from IndexedDB
      if (song.hasStoredAudio && song.url && song.url.startsWith("indexeddb://")) {
        const cached = songCacheRef.current.get(song.id);
        if (cached) {
          console.log("useSongCache: Song already cached", { songId: song.id });
          return;
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
          console.log("useSongCache: Cached song from IndexedDB", { songId: song.id });
          return;
        }
      }

      // If not in IndexedDB or failed to load, fetch from original URL
      if (!song.url || song.url.startsWith("indexeddb://")) {
        console.error("useSongCache: No valid URL to fetch song from:", song.id);
        return;
      }

      const response = await fetch(song.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
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
      console.log("useSongCache: Cached song from URL", { songId: song.id });
    } catch (error) {
      console.error("useSongCache: Failed to cache song:", error);
    }
  }, []);

  const getCachedSong = useCallback((songId: string): CachedSong | undefined => {
    console.log("useSongCache: getCachedSong called", { songId });
    
    if (!songId) {
      console.error("useSongCache: Invalid songId provided to getCachedSong");
      return undefined;
    }
    
    const cached = songCacheRef.current.get(songId);
    if (cached) {
      console.log("useSongCache: Returned cached song", { songId });
    }
    return cached;
  }, []);

  const clearExpiredCache = useCallback(() => {
    console.log("useSongCache: clearExpiredCache called");
    const now = Date.now();
    const expiry = CACHE_CONFIG.current.CACHE_EXPIRY;
    
    for (const [id, cached] of songCacheRef.current.entries()) {
      if (now - cached.loadedAt > expiry) {
        URL.revokeObjectURL(cached.url);
        songCacheRef.current.delete(id);
        console.log("useSongCache: Removed expired cache entry", { songId: id });
      }
    }
  }, []);

  const updateSongCache = useCallback(async (
    currentSong: Song | null,
    playlist: Playlist | null,
    shuffle: boolean
  ) => {
    console.log("useSongCache: updateSongCache called", {
      songId: currentSong?.id,
      playlistId: playlist?.id,
      shuffle,
    });
    
    if (!currentSong || !playlist || !playlist.songs || playlist.songs.length === 0) {
      console.warn("useSongCache: Invalid parameters for updateSongCache");
      return;
    }

    clearExpiredCache();

    const currentIndex = playlist.songs.findIndex(
      (s) => s?.id === currentSong.id
    );
    
    if (currentIndex === -1) {
      console.warn("useSongCache: Current song not found in playlist", {
        songId: currentSong.id,
        playlistId: playlist.id,
      });
      return;
    }

    // Get the range of songs to cache
    const config = CACHE_CONFIG.current;
    const start = Math.max(0, currentIndex - config.PREV_SONGS);
    const end = Math.min(
      playlist.songs.length - 1,
      currentIndex + config.NEXT_SONGS
    );

    // Get next shuffled song if shuffle is enabled
    let nextShuffledSong: Song | null = null;
    if (shuffle) {
      const availableSongs = playlist.songs.filter(
        (_, i) => i !== currentIndex
      );
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        nextShuffledSong = availableSongs[randomIndex];
        if (nextShuffledSong) {
          console.log("useSongCache: Selected next shuffled song", {
            songId: nextShuffledSong.id,
          });
        }
      }
    }

    // Create a set of songs to cache
    const songsToCache = new Set([
      ...playlist.songs.slice(start, end + 1).filter(Boolean), // Filter out any null/undefined songs
      ...(nextShuffledSong ? [nextShuffledSong] : []),
    ]);

    // Cache new songs and remove old ones
    const promises: Promise<void>[] = [];
    for (const song of songsToCache) {
      if (song && song.id && !songCacheRef.current.has(song.id)) {
        console.log("useSongCache: Queuing song for caching", { songId: song.id });
        promises.push(cacheSong(song));
      }
    }

    // Remove songs that are no longer needed
    for (const [id, cached] of songCacheRef.current.entries()) {
      if (
        !Array.from(songsToCache).some((song) => song?.id === cached.song.id)
      ) {
        URL.revokeObjectURL(cached.url);
        songCacheRef.current.delete(id);
        console.log("useSongCache: Removed unneeded cache entry", { songId: id });
      }
    }

    try {
      await Promise.all(promises);
      console.log("useSongCache: updateSongCache completed", {
        cachedSongs: Array.from(songCacheRef.current.keys()),
      });
    } catch (error) {
      console.error("useSongCache: Error in updateSongCache:", error);
    }
  }, [cacheSong, clearExpiredCache]);

  // Helper to ensure playlist songs have correct URLs
  const prepareSongsForPlaylist = useCallback((songs: Song[]): Song[] => {
    console.log("useSongCache: prepareSongsForPlaylist called", {
      songCount: songs?.length || 0,
    });
    
    if (!songs || !Array.isArray(songs)) {
      console.warn("useSongCache: Invalid songs array provided to prepareSongsForPlaylist");
      return [];
    }
    
    return songs.filter(Boolean).map((song) => {
      if (!song || !song.id) {
        console.warn("useSongCache: Invalid song in prepareSongsForPlaylist");
        return song;
      }
      
      if (song.hasStoredAudio) {
        return {
          ...song,
          url: `indexeddb://${song.id}`,
        };
      } else if (songCacheRef.current.has(song.id)) {
        const cached = songCacheRef.current.get(song.id);
        return {
          ...song,
          url: cached?.url || song.url,
        };
      }
      return song;
    });
  }, []);

  // FIXED: Use useMemo at the top level instead of inside useCallback
  // This prevents the "Rules of Hooks" violation
  const memoizedPrepareSongsForPlaylist = useCallback(
    (songs: Song[]): Song[] => {
      console.log("useSongCache: memoizedPrepareSongsForPlaylist called", {
        songCount: songs?.length || 0,
      });
      
      // Simple memoization using ref instead of useMemo inside useCallback
      const lastPrepared = lastPreparedSongsRef.current;
      if (lastPrepared && 
          lastPrepared.input.length === songs.length &&
          lastPrepared.input.every((song, index) => song?.id === songs[index]?.id)) {
        console.log("useSongCache: Returning memoized result");
        return lastPrepared.output;
      }
      
      const result = prepareSongsForPlaylist(songs);
      lastPreparedSongsRef.current = { input: songs, output: result };
      return result;
    },
    [prepareSongsForPlaylist]
  );

  // Cleanup cache on unmount
  useEffect(() => {
    console.log("useSongCache: Cleanup useEffect triggered");
    return () => {
      console.log("useSongCache: Cleaning up cache on unmount");
      for (const [, cached] of songCacheRef.current.entries()) {
        if (cached?.url) {
          URL.revokeObjectURL(cached.url);
        }
      }
      songCacheRef.current.clear();
      lastPreparedSongsRef.current = null;
    };
  }, []);

  return {
    songCacheRef,
    cacheSong,
    CACHE_CONFIG: CACHE_CONFIG.current,
    clearExpiredCache,
    getCachedSong,
    updateSongCache,
    memoizedPrepareSongsForPlaylist,
  };
};