import type { Track } from "../../core/engine/types";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("preloader");

interface PreloadWaiter {
  resolve: (url: string) => void;
  reject: (error: unknown) => void;
}

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

export interface PreloadOptions {
  resolveTrack?: (track: Track) => Promise<Track>;
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
  private preloadCallbacks: Map<string, Set<PreloadWaiter>> = new Map();
  private readonly resolveTrack?: (track: Track) => Promise<Track>;

  constructor(
    config: Partial<PreloadConfig> = {},
    options: PreloadOptions = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.resolveTrack = options.resolveTrack;
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
      return new Promise<string>((resolve, reject) => {
        const waiters =
          this.preloadCallbacks.get(track.id) ?? new Set<PreloadWaiter>();
        waiters.add({ resolve, reject });
        this.preloadCallbacks.set(track.id, waiters);
      });
    }

    this.loading.add(track.id);

    try {
      const source = this.resolveTrack ? await this.resolveTrack(track) : track;
      const response = await fetch(source.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      this.cache.set(track.id, {
        track,
        url,
        loadedAt: Date.now(),
      });

      this.evictIfNeeded();
      this.settleWaiters(track.id, { url });

      return url;
    } catch (error) {
      this.settleWaiters(track.id, { error });
      throw error;
    } finally {
      this.loading.delete(track.id);
    }
  }

  private settleWaiters(
    trackId: string,
    outcome: { url: string } | { error: unknown },
  ): void {
    const waiters = this.preloadCallbacks.get(trackId);
    this.preloadCallbacks.delete(trackId);
    if (!waiters) return;

    for (const waiter of waiters) {
      if ("url" in outcome) {
        waiter.resolve(outcome.url);
      } else {
        waiter.reject(outcome.error);
      }
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
      if (
        track &&
        track.url &&
        !this.isLoaded(track.id) &&
        !this.loading.has(track.id)
      ) {
        this.preload(track).catch((e) =>
          logger.error("Preload failed", { error: String(e) }),
        );
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

export function createPreloadManager(
  config?: Partial<PreloadConfig>,
): PreloadManager {
  return new PreloadManager(config);
}
