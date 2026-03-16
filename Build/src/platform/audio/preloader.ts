import type { Track } from "../../core/engine/types";

export interface CachedTrack {
  track: Track;
  url: string;
  loadedAt: number;
}

export interface PreloadConfig {
  preloadCount: number;
  maxCacheSize: number;
  ttl: number;
}

const DEFAULT_CONFIG: PreloadConfig = {
  preloadCount: 2,
  maxCacheSize: 5,
  ttl: 5 * 60 * 1000,
};

export class PreloadManager {
  private cache: Map<string, CachedTrack> = new Map();
  private config: PreloadConfig;
  private loading: Set<string> = new Set();
  private preloadCallbacks: Map<string, (url: string) => void> = new Map();

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<PreloadConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): PreloadConfig {
    return { ...this.config };
  }

  isLoaded(trackId: string): boolean {
    const cached = this.cache.get(trackId);
    if (!cached) return false;

    if (Date.now() - cached.loadedAt > this.config.ttl) {
      this.cache.delete(trackId);
      return false;
    }

    return true;
  }

  getUrl(trackId: string): string | null {
    const cached = this.cache.get(trackId);
    if (!cached || !this.isLoaded(trackId)) return null;
    return cached.url;
  }

  async preload(track: Track): Promise<string> {
    if (this.isLoaded(track.id)) {
      return this.getUrl(track.id)!;
    }

    if (this.loading.has(track.id)) {
      return new Promise((resolve) => {
        this.preloadCallbacks.set(track.id, resolve);
      });
    }

    this.loading.add(track.id);

    try {
      const response = await fetch(track.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      this.cache.set(track.id, {
        track,
        url,
        loadedAt: Date.now(),
      });

      this.evictIfNeeded();

      const callback = this.preloadCallbacks.get(track.id);
      if (callback) {
        callback(url);
        this.preloadCallbacks.delete(track.id);
      }

      return url;
    } catch (error) {
      this.loading.delete(track.id);
      const callback = this.preloadCallbacks.get(track.id);
      if (callback) {
        callback(track.url);
        this.preloadCallbacks.delete(track.id);
      }
      throw error;
    } finally {
      this.loading.delete(track.id);
    }
  }

  preloadNext(tracks: Track[], currentIndex: number): void {
    const indices: number[] = [];

    for (let i = 1; i <= this.config.preloadCount; i++) {
      const nextIndex = (currentIndex + i) % tracks.length;
      if (!indices.includes(nextIndex)) {
        indices.push(nextIndex);
      }
    }

    for (const index of indices) {
      const track = tracks[index];
      if (track && !this.isLoaded(track.id) && !this.loading.has(track.id)) {
        this.preload(track).catch(console.error);
      }
    }
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.config.maxCacheSize) {
      let oldest: string | null = null;
      let oldestTime = Infinity;

      for (const [id, cached] of this.cache) {
        if (cached.loadedAt < oldestTime) {
          oldestTime = cached.loadedAt;
          oldest = id;
        }
      }

      if (oldest) {
        this.evict(oldest);
      }
    }
  }

  evict(trackId: string): void {
    const cached = this.cache.get(trackId);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      this.cache.delete(trackId);
    }
  }

  evictAll(): void {
    for (const [id] of this.cache) {
      this.evict(id);
    }
  }

  isLoading(trackId: string): boolean {
    return this.loading.has(trackId);
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getLoadingCount(): number {
    return this.loading.size;
  }
}

export function createPreloadManager(config?: Partial<PreloadConfig>): PreloadManager {
  return new PreloadManager(config);
}