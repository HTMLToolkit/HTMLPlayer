import { useState, useEffect, useRef } from "react";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";

// Cache to store loaded album arts in memory
const loadedAlbumArts = new Map<string, string>();
// Pending load requests to avoid duplicate fetches
const pendingLoads = new Map<string, Promise<string | null>>();

/**
 * Hook to lazily load album art for a single song
 * Only fetches from IndexedDB when needed, uses in-memory cache
 */
export function useAlbumArt(songId: string | undefined, hasAlbumArt: boolean = false): string | undefined {
  const [albumArt, setAlbumArt] = useState<string | undefined>(() => {
    // Check cache immediately for initial render
    if (songId && loadedAlbumArts.has(songId)) {
      return loadedAlbumArts.get(songId);
    }
    return undefined;
  });

  useEffect(() => {
    if (!songId || !hasAlbumArt) {
      setAlbumArt(undefined);
      return;
    }

    // Check memory cache first
    if (loadedAlbumArts.has(songId)) {
      setAlbumArt(loadedAlbumArts.get(songId));
      return;
    }

    // Check if already loading
    if (pendingLoads.has(songId)) {
      pendingLoads.get(songId)!.then((art) => {
        if (art) setAlbumArt(art);
      });
      return;
    }

    // Start loading
    const loadPromise = musicIndexedDbHelper.loadAlbumArt(songId);
    pendingLoads.set(songId, loadPromise);

    loadPromise
      .then((art) => {
        if (art) {
          loadedAlbumArts.set(songId, art);
          setAlbumArt(art);
        }
      })
      .finally(() => {
        pendingLoads.delete(songId);
      });
  }, [songId, hasAlbumArt]);

  return albumArt;
}

/**
 * Hook to batch load album art for visible songs
 * More efficient for lists - loads multiple arts in one IndexedDB transaction
 */
export function useAlbumArtBatch(songs: Array<{ id: string; hasAlbumArt?: boolean }>): Map<string, string> {
  const [albumArts, setAlbumArts] = useState<Map<string, string>>(new Map());
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    if (songs.length === 0) return;

    // Find songs that need loading
    const toLoad = songs.filter(
      (song) => song.hasAlbumArt && !loadedAlbumArts.has(song.id) && !loadedRef.current.has(song.id)
    );

    if (toLoad.length === 0) {
      // All already cached, update state if needed
      const cached = new Map<string, string>();
      for (const song of songs) {
        if (loadedAlbumArts.has(song.id)) {
          cached.set(song.id, loadedAlbumArts.get(song.id)!);
        }
      }
      if (cached.size > 0) {
        setAlbumArts(cached);
      }
      return;
    }

    // Mark as loading to prevent duplicate requests
    toLoad.forEach((song) => loadedRef.current.add(song.id));

    // Batch load
    musicIndexedDbHelper.loadAlbumArtBatch(toLoad.map((s) => s.id)).then((loaded) => {
      // Update memory cache
      loaded.forEach((art, songId) => {
        loadedAlbumArts.set(songId, art);
      });

      // Update state with all cached arts
      const allArts = new Map<string, string>();
      for (const song of songs) {
        if (loadedAlbumArts.has(song.id)) {
          allArts.set(song.id, loadedAlbumArts.get(song.id)!);
        }
      }
      setAlbumArts(allArts);
    });
  }, [songs]);

  return albumArts;
}

/**
 * Get album art directly from cache without loading
 * Returns undefined if not in cache
 */
export function getAlbumArtFromCache(songId: string): string | undefined {
  return loadedAlbumArts.get(songId);
}

/**
 * Preload album art for songs (useful for current/next songs)
 */
export async function preloadAlbumArt(songIds: string[]): Promise<void> {
  const toLoad = songIds.filter((id) => !loadedAlbumArts.has(id));
  if (toLoad.length === 0) return;

  const loaded = await musicIndexedDbHelper.loadAlbumArtBatch(toLoad);
  loaded.forEach((art, songId) => {
    loadedAlbumArts.set(songId, art);
  });
}

/**
 * Clear album art cache to free memory
 * Call this when switching views or when memory pressure is high
 */
export function clearAlbumArtCache(): void {
  loadedAlbumArts.clear();
  musicIndexedDbHelper.clearAlbumArtCache();
}

/**
 * Set album art in cache directly (used when importing new songs)
 */
export function setAlbumArtInCache(songId: string, albumArt: string): void {
  loadedAlbumArts.set(songId, albumArt);
}
