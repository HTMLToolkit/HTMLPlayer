import { MutableRefObject } from "react";

// Smart shuffle algorithm using Fisher-Yates shuffle with play history awareness
// (this was fun to research and implement!)
export const getSmartShuffledSong = (
  availableSongs: Song[],
  currentSongId: string,
  playHistory: Map<string, { lastPlayed: number; playCount: number }>
): Song | null => {
  if (availableSongs.length === 0) return null;

  const now = Date.now();
  const candidates = availableSongs.filter((song) => song.id !== currentSongId);

  if (candidates.length === 0) return null;

  // Calculate weights based on recency and play frequency
  const songsWithWeights = candidates.map((song) => {
    const history = playHistory.get(song.id);
    let weight = 100; // Base weight

    if (history) {
      const timeSinceLastPlayed = now - history.lastPlayed;
      const hoursAgo = timeSinceLastPlayed / (1000 * 60 * 60);

      // Reduce weight based on recency (exponential decay)
      if (hoursAgo < 24) {
        weight *= Math.pow(0.5, Math.max(0, 4 - hoursAgo)); // Heavy penalty for recent plays
      }

      // Slightly reduce weight for frequently played songs
      weight *= Math.max(0.3, 1 - history.playCount * 0.1);
    }

    return { song, weight };
  });

  // Weighted random selection using reservoir sampling
  const totalWeight = songsWithWeights.reduce(
    (sum, item) => sum + item.weight,
    0
  );
  let randomValue = Math.random() * totalWeight;

  for (const item of songsWithWeights) {
    randomValue -= item.weight;
    if (randomValue <= 0) {
      return item.song;
    }
  }

  // Fallback to last candidate
  return candidates[candidates.length - 1];
};

// Next song cache manager
export const createNextSongManager = (
  nextSongCacheRef: MutableRefObject<Song | null>,
  nextSongCacheValidRef: MutableRefObject<boolean>
) => {
  let lastCacheInvalidation = 0;
  const CACHE_INVALIDATION_THROTTLE = 500; // Throttle invalidations to max once per 500ms

  // Function to determine and cache the next song
  const getAndCacheNextSong = (
    playerStateRef: MutableRefObject<any>,
    settingsRef: MutableRefObject<any>,
    playHistoryRef: MutableRefObject<
      Map<string, { lastPlayed: number; playCount: number }>
    >
  ): Song | null => {
    if (
      !playerStateRef.current.currentPlaylist ||
      !playerStateRef.current.currentSong
    ) {
      return null;
    }

    // If we have a valid cached next song, return it
    if (nextSongCacheValidRef.current && nextSongCacheRef.current) {
      return nextSongCacheRef.current;
    }

    const songs = playerStateRef.current.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s: { id: any }) => s.id === playerStateRef.current.currentSong!.id
    );
    let nextSong: Song | null = null;

    if (playerStateRef.current.shuffle) {
      const available = songs.filter(
        (s: { id: any }) => s.id !== playerStateRef.current.currentSong!.id
      );
      if (available.length > 0) {
        if (settingsRef.current.smartShuffle) {
          // Use improved smart shuffle algorithm
          nextSong = getSmartShuffledSong(
            available,
            playerStateRef.current.currentSong!.id,
            playHistoryRef.current
          );
          if (!nextSong) {
            nextSong = available[Math.floor(Math.random() * available.length)];
          }
        } else {
          // Use regular shuffle
          const randomIndex = Math.floor(Math.random() * available.length);
          nextSong = available[randomIndex];
        }
      }
    } else {
      if (currentIndex < songs.length - 1) {
        nextSong = songs[currentIndex + 1];
      } else if (playerStateRef.current.repeat === "all") {
        nextSong = songs[0];
      }
    }

    // Cache the result
    nextSongCacheRef.current = nextSong;
    nextSongCacheValidRef.current = true;

    return nextSong;
  };

  // Throttled function to invalidate the next song cache
  const invalidateNextSongCache = (force = false) => {
    const now = Date.now();
    if (force || now - lastCacheInvalidation > CACHE_INVALIDATION_THROTTLE) {
      nextSongCacheRef.current = null;
      nextSongCacheValidRef.current = false;
      lastCacheInvalidation = now;
    }
  };

  // Function to update play history
  const updatePlayHistory = (
    playHistoryRef: MutableRefObject<
      Map<string, { lastPlayed: number; playCount: number }>
    >,
    songId: string
  ) => {
    const now = Date.now();
    const currentHistory = playHistoryRef.current.get(songId) || {
      lastPlayed: 0,
      playCount: 0,
    };

    playHistoryRef.current.set(songId, {
      lastPlayed: now,
      playCount: currentHistory.playCount + 1,
    });

    // Clean up old entries (older than 7 days)
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    for (const [id, history] of playHistoryRef.current.entries()) {
      if (history.lastPlayed < weekAgo) {
        playHistoryRef.current.delete(id);
      }
    }
  };

  return {
    getAndCacheNextSong,
    invalidateNextSongCache,
    updatePlayHistory,
  };
};
