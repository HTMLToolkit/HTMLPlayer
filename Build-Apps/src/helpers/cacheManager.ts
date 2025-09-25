import { MutableRefObject, useCallback } from "react";
import { musicIndexedDbHelper } from "./musicIndexedDbHelper";

const CACHE_CONFIG = {
  PREV_SONGS: 2, // Number of previous songs to cache
  NEXT_SONGS: 4, // Increased for better preloading
  CACHE_EXPIRY: 10 * 60 * 1000, // Increased to 10 minutes
  MAX_CACHE_SIZE: 50, // Maximum number of songs to cache
  PRELOAD_THRESHOLD: 10 * 1024 * 1024, // 10MB - only preload smaller files
};

// Cache management utilities with improved error handling and performance
export const createCacheManager = (
  songCacheRef: MutableRefObject<Map<string, CachedSong>>
) => {
  const cacheSong = async (song: Song): Promise<void> => {
    // Check if song is already cached and valid
    const existingCache = songCacheRef.current.get(song.id);
    if (existingCache) {
      // Check if cache is still valid
      const cacheAge = Date.now() - existingCache.loadedAt;
      if (cacheAge < CACHE_CONFIG.CACHE_EXPIRY) {
        // Update URL if it's from IndexedDB and needs refresh
        if (song.hasStoredAudio && song.url.startsWith("indexeddb://")) {
          try {
            const audioData = await musicIndexedDbHelper.loadSongAudio(song.id);
            if (audioData && !existingCache.url.startsWith("blob:")) {
              // Need to create new blob URL
              const newUrl = URL.createObjectURL(
                new Blob([audioData.fileData], { type: audioData.mimeType })
              );
              // Revoke old URL if it was a blob
              if (existingCache.url.startsWith("blob:")) {
                URL.revokeObjectURL(existingCache.url);
              }
              // Update cache with new URL
              songCacheRef.current.set(song.id, {
                ...existingCache,
                url: newUrl,
                song: { ...song, url: newUrl },
                loadedAt: Date.now(),
              });
            }
          } catch (error) {
            console.warn(
              "Failed to refresh IndexedDB cache for song:",
              song.id,
              error
            );
          }
        }
        // Already cached, no need to return anything
      } else {
        // Cache expired, remove it
        if (existingCache.url.startsWith("blob:")) {
          URL.revokeObjectURL(existingCache.url);
        }
        songCacheRef.current.delete(song.id);
      }
    }

    try {
      let audioData;
      let mimeType: string;

      // First try to load from IndexedDB
      if (song.hasStoredAudio) {
        console.log("CacheManager: Loading song from IndexedDB:", song.id);
        audioData = await musicIndexedDbHelper.loadSongAudio(song.id);
        if (audioData) {
          const url = URL.createObjectURL(
            new Blob([audioData.fileData], { type: audioData.mimeType })
          );
          songCacheRef.current.set(song.id, {
            song: { ...song, url },
            audioBuffer: audioData.fileData,
            url,
            loadedAt: Date.now(),
          });
          console.log(
            "CacheManager: Successfully cached song from IndexedDB:",
            song.title
          );
        }
      }

            // If not in IndexedDB or failed to load, fetch from original URL
      // But don't try to fetch if the song has stored audio (should only be loaded from IndexedDB)
      if (song.hasStoredAudio) {
        console.warn(
          "CacheManager: Song has stored audio but not found in IndexedDB:",
          song.id
        );
        return;
      }

      if (
        !song.url ||
        song.url.startsWith("indexeddb://") ||
        song.url.includes("about:blank")
      ) {
        console.error(
          "CacheManager: No valid URL to fetch song from:",
          song.id
        );
        return;
      }

      console.log("CacheManager: Fetching song from URL:", song.title);

      // Check if we should preload based on file size (if available)
      let shouldCache = true;

      try {
        const headResponse = await fetch(song.url, { method: "HEAD" });
        const contentLength = headResponse.headers.get("content-length");
        if (contentLength) {
          const fileSize = parseInt(contentLength);
          if (fileSize > CACHE_CONFIG.PRELOAD_THRESHOLD) {
            console.log(
              "CacheManager: Large file detected, skipping aggressive caching:",
              song.title
            );
            shouldCache = false;
          }
        }
      } catch (headError) {
        // HEAD request failed, continue with normal caching
        console.warn(
          "CacheManager: HEAD request failed, continuing with caching:",
          headError
        );
      }

      const response = await fetch(song.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      mimeType = response.headers.get("content-type") || "audio/mpeg";
      const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));

      // Cache in memory if appropriate
      if (shouldCache || buffer.byteLength <= CACHE_CONFIG.PRELOAD_THRESHOLD) {
        songCacheRef.current.set(song.id, {
          song: { ...song, url },
          audioBuffer: buffer,
          url,
          loadedAt: Date.now(),
        });
      }

      // Always save to IndexedDB for future use (unless it came from there originally)
      if (!song.hasStoredAudio) {
        try {
          await musicIndexedDbHelper.saveSongAudio(song.id, {
            fileData: buffer,
            mimeType: mimeType,
          });
          console.log("CacheManager: Saved song to IndexedDB:", song.title);
        } catch (dbError) {
          console.warn("CacheManager: Failed to save to IndexedDB:", dbError);
        }
      }

      console.log(
        "CacheManager: Successfully cached song from URL:",
        song.title
      );
    } catch (error) {
      console.error("CacheManager: Failed to cache song:", song.title, error);
    }
  };

  const getCachedSong = (songId: string): CachedSong | undefined => {
    const cached = songCacheRef.current.get(songId);
    if (cached) {
      // Check if cache is still valid
      const cacheAge = Date.now() - cached.loadedAt;
      if (cacheAge < CACHE_CONFIG.CACHE_EXPIRY) {
        return cached;
      } else {
        // Cache expired, remove it
        if (cached.url.startsWith("blob:")) {
          URL.revokeObjectURL(cached.url);
        }
        songCacheRef.current.delete(songId);
      }
    }
    return undefined;
  };

  const clearExpiredCache = () => {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [id, cached] of songCacheRef.current.entries()) {
      if (now - cached.loadedAt > CACHE_CONFIG.CACHE_EXPIRY) {
        expiredKeys.push(id);
        if (cached.url.startsWith("blob:")) {
          URL.revokeObjectURL(cached.url);
        }
      }
    }

    expiredKeys.forEach((key) => songCacheRef.current.delete(key));

    if (expiredKeys.length > 0) {
      console.log(
        `CacheManager: Cleared ${expiredKeys.length} expired cache entries`
      );
    }
  };

  const enforceCacheSize = () => {
    if (songCacheRef.current.size <= CACHE_CONFIG.MAX_CACHE_SIZE) return;

    // Sort by last accessed time (oldest first)
    const entries = Array.from(songCacheRef.current.entries()).sort(
      (a, b) => a[1].loadedAt - b[1].loadedAt
    );

    const toRemove = entries.slice(
      0,
      songCacheRef.current.size - CACHE_CONFIG.MAX_CACHE_SIZE
    );

    for (const [id, cached] of toRemove) {
      if (cached.url.startsWith("blob:")) {
        URL.revokeObjectURL(cached.url);
      }
      songCacheRef.current.delete(id);
    }

    console.log(
      `CacheManager: Removed ${toRemove.length} entries to enforce cache size limit`
    );
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
    playlist: Playlist | null,
    playerStateRef: MutableRefObject<any>,
    settingsRef: MutableRefObject<any>,
    playHistoryRef: MutableRefObject<
      Map<string, { lastPlayed: number; playCount: number }>
    >,
    getSmartShuffledSong: (
      availableSongs: Song[],
      currentSongId: string,
      playHistory: Map<string, { lastPlayed: number; playCount: number }>
    ) => Song | null
  ) => {
    if (!currentSong || !playlist) return;

    // Periodic cleanup
    clearExpiredCache();
    enforceCacheSize();

    const currentIndex = playlist.songs.findIndex(
      (s) => s.id === currentSong.id
    );
    if (currentIndex === -1) return;

    // Get the range of songs to cache (surrounding the current song)
    const start = Math.max(0, currentIndex - CACHE_CONFIG.PREV_SONGS);
    const end = Math.min(
      playlist.songs.length - 1,
      currentIndex + CACHE_CONFIG.NEXT_SONGS
    );

    // Get next shuffled songs if shuffle is enabled (cache multiple for better performance)
    const nextShuffledSongs: Song[] = [];
    if (playerStateRef.current.shuffle) {
      const availableSongs = playlist.songs.filter(
        (_, i) => i !== currentIndex
      );

      if (availableSongs.length > 0) {
        // Cache multiple potential next songs for shuffle
        const songsToGenerate = Math.min(3, availableSongs.length);
        const usedSongs = new Set<string>();

        for (let i = 0; i < songsToGenerate; i++) {
          let nextSong: Song | null = null;

          if (settingsRef.current.smartShuffle) {
            // Use smart shuffle for caching
            const availableForThis = availableSongs.filter(
              (s) => !usedSongs.has(s.id)
            );
            nextSong = getSmartShuffledSong(
              availableForThis,
              currentSong.id,
              playHistoryRef.current
            );
          } else {
            // Use regular shuffle for caching
            const availableForThis = availableSongs.filter(
              (s) => !usedSongs.has(s.id)
            );
            if (availableForThis.length > 0) {
              const randomIndex = Math.floor(
                Math.random() * availableForThis.length
              );
              nextSong = availableForThis[randomIndex];
            }
          }

          if (nextSong && !usedSongs.has(nextSong.id)) {
            nextShuffledSongs.push(nextSong);
            usedSongs.add(nextSong.id);
          }
        }
      }
    }

    // Create a set of songs to cache (prioritize nearby songs and shuffled options)
    const songsToCache = new Set([
      ...playlist.songs.slice(start, end + 1),
      ...nextShuffledSongs,
    ]);

    // Cache new songs (prioritize current and next songs)
    const cachePromises: Promise<void>[] = [];
    const songsArray = Array.from(songsToCache);

    // Sort by priority: current song first, then immediate neighbors, then shuffled options
    songsArray.sort((a, b) => {
      if (a.id === currentSong.id) return -1;
      if (b.id === currentSong.id) return 1;

      const aIndex = playlist.songs.findIndex((s) => s.id === a.id);
      const bIndex = playlist.songs.findIndex((s) => s.id === b.id);

      const aDistance = Math.abs(aIndex - currentIndex);
      const bDistance = Math.abs(bIndex - currentIndex);

      return aDistance - bDistance;
    });

    // Cache songs in priority order
    for (const song of songsArray) {
      if (!songCacheRef.current.has(song.id)) {
        cachePromises.push(cacheSong(song));
      }
    }

    // Remove songs that are no longer needed (but keep some buffer)
    const currentCacheIds = new Set(Array.from(songCacheRef.current.keys()));
    const keepIds = new Set(songsArray.map((song) => song.id));

    for (const cachedId of currentCacheIds) {
      if (!keepIds.has(cachedId)) {
        const cached = songCacheRef.current.get(cachedId);
        if (cached) {
          // Only remove if it's not recently accessed
          const age = Date.now() - cached.loadedAt;
          if (age > CACHE_CONFIG.CACHE_EXPIRY / 2) {
            if (cached.url.startsWith("blob:")) {
              URL.revokeObjectURL(cached.url);
            }
            songCacheRef.current.delete(cachedId);
          }
        }
      }
    }

    // Wait for priority caches to complete (don't block on all)
    try {
      const results = await Promise.allSettled(cachePromises);
      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value
      ).length;
      console.log(
        `CacheManager: Successfully cached ${successful} of ${cachePromises.length} songs`
      );
    } catch (error) {
      console.error("CacheManager: Error in batch caching:", error);
    }
  };

  const clearAllCache = () => {
    console.log("CacheManager: Clearing all cache");

    // Revoke all object URLs and clear the cache
    for (const [, cached] of songCacheRef.current.entries()) {
      if (cached.url.startsWith("blob:")) {
        URL.revokeObjectURL(cached.url);
      }
    }
    songCacheRef.current.clear();
  };

  const getCacheStats = () => {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    for (const [, cached] of songCacheRef.current.entries()) {
      if (now - cached.loadedAt < CACHE_CONFIG.CACHE_EXPIRY) {
        validCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      total: songCacheRef.current.size,
      valid: validCount,
      expired: expiredCount,
      maxSize: CACHE_CONFIG.MAX_CACHE_SIZE,
    };
  };

  return {
    cacheSong,
    getCachedSong,
    clearExpiredCache,
    enforceCacheSize,
    prepareSongsForPlaylist,
    updateSongCache,
    clearAllCache,
    getCacheStats,
  };
};
