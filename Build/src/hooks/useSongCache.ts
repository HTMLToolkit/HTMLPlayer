import { useCallback, useEffect, useRef } from "react";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { Playlist } from "../types/Playlist";
import { Song } from "../types/Song";
import { playerStateRef } from "./useAudioPlayback";

export const useSongCache = () => {
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

  return {
    songCacheRef,
    cacheSong,
    CACHE_CONFIG,
    clearExpiredCache,
    getCachedSong,
    updateSongCache,
    prepareSongsForPlaylist,
  };
};
