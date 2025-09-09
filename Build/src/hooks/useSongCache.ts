import { useCallback, useEffect, useMemo, useRef } from "react";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { Playlist } from "../types/Playlist";
import { Song } from "../types/Song";

export const useSongCache = () => {
  const instantiationRef = useRef(false);
  if (instantiationRef.current) {
    console.warn("useSongCache: Attempted re-instantiation, preventing loop");
    throw new Error("Preventing recursive useSongCache instantiation");
  }
  instantiationRef.current = true;
  console.log("useSongCache: Instantiated");

  const songCacheRef = useRef<Map<string, CachedSong>>(new Map());

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

  // Cache management functions
  const cacheSong = useCallback(async (song: Song) => {
    console.log("useSongCache: cacheSong called", { songId: song.id });
    // Check if song is already cached by ID
    if (songCacheRef.current.has(song.id)) {
      // Update the cached song's URL if it's from IndexedDB
      if (song.hasStoredAudio && song.url.startsWith("indexeddb://")) {
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
    const cached = songCacheRef.current.get(songId);
    if (cached) {
      console.log("useSongCache: Returned cached song", { songId });
    }
    return cached;
  }, []);

  const clearExpiredCache = useCallback(() => {
    console.log("useSongCache: clearExpiredCache called");
    const now = Date.now();
    for (const [id, cached] of songCacheRef.current.entries()) {
      if (now - cached.loadedAt > CACHE_CONFIG.CACHE_EXPIRY) {
        URL.revokeObjectURL(cached.url);
        songCacheRef.current.delete(id);
        console.log("useSongCache: Removed expired cache entry", { songId: id });
      }
    }
  }, [CACHE_CONFIG.CACHE_EXPIRY]);

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
    if (!currentSong || !playlist) return;

    clearExpiredCache();

    const currentIndex = playlist.songs.findIndex(
      (s) => s.id === currentSong.id
    );
    if (currentIndex === -1) {
      console.warn("useSongCache: Current song not found in playlist", {
        songId: currentSong.id,
        playlistId: playlist.id,
      });
      return;
    }

    // Get the range of songs to cache
    const start = Math.max(0, currentIndex - CACHE_CONFIG.PREV_SONGS);
    const end = Math.min(
      playlist.songs.length - 1,
      currentIndex + CACHE_CONFIG.NEXT_SONGS
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
        if (!nextShuffledSong) return;
        console.log("useSongCache: Selected next shuffled song", {
          songId: nextShuffledSong.id,
        });
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
        console.log("useSongCache: Queuing song for caching", { songId: song.id });
        promises.push(cacheSong(song));
      }
    }

    // Remove songs that are no longer needed
    for (const [id, cached] of songCacheRef.current.entries()) {
      if (
        !Array.from(songsToCache).some((song) => song.id === cached.song.id)
      ) {
        URL.revokeObjectURL(cached.url);
        songCacheRef.current.delete(id);
        console.log("useSongCache: Removed unneeded cache entry", { songId: id });
      }
    }

    await Promise.all(promises);
    console.log("useSongCache: updateSongCache completed", {
      cachedSongs: Array.from(songCacheRef.current.keys()),
    });
  }, [cacheSong, clearExpiredCache, CACHE_CONFIG.PREV_SONGS, CACHE_CONFIG.NEXT_SONGS]);

  // Helper to ensure playlist songs have correct URLs
  const prepareSongsForPlaylist = useCallback((songs: Song[]): Song[] => {
    console.log("useSongCache: prepareSongsForPlaylist called", {
      songCount: songs.length,
    });
    return songs.map((song) => {
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

  // Memoize the result to avoid creating new arrays unnecessarily
  const memoizedPrepareSongsForPlaylist = useCallback(
    (songs: Song[]): Song[] => {
      console.log("useSongCache: memoizedPrepareSongsForPlaylist called", {
        songCount: songs.length,
      });
      return useMemo(() => prepareSongsForPlaylist(songs), [songs]);
    },
    [prepareSongsForPlaylist]
  );

  // Cleanup cache on unmount
  useEffect(() => {
    console.log("useSongCache: Cleanup useEffect triggered");
    return () => {
      console.log("useSongCache: Cleaning up cache on unmount");
      for (const [, cached] of songCacheRef.current.entries()) {
        URL.revokeObjectURL(cached.url);
      }
      songCacheRef.current.clear();
    };
  }, []);

  return {
    songCacheRef,
    cacheSong,
    CACHE_CONFIG,
    clearExpiredCache,
    getCachedSong,
    updateSongCache,
    memoizedPrepareSongsForPlaylist,
  };
};
