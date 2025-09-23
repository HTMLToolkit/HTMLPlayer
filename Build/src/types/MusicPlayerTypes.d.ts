type CachedSong = {
  song: Song;
  audioBuffer: ArrayBuffer;
  url: string;
  loadedAt: number;
};

const CACHE_CONFIG = {
  PREV_SONGS: 2, // Number of previous songs to cache
  NEXT_SONGS: 3, // Number of next songs to cache
  CACHE_EXPIRY: 5 * 60 * 1000, // 5 minutes in milliseconds
};