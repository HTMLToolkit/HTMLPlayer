import type { SearchQuery, ProviderResult } from "./base";
import type { Lyrics, LyricsProvider } from "./lyricsTypes";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("lyricsManager");

export class LyricsManager {
  private providers: LyricsProvider[] = [];
  private cache: Map<string, ProviderResult<Lyrics>> = new Map();
  private misses: Set<string> = new Set();
  private inFlight: Map<string, Promise<Lyrics | null>> = new Map();

  addProvider(provider: LyricsProvider): void {
    this.providers.push(provider);
  }

  async fetchLyrics(query: SearchQuery): Promise<Lyrics | null> {
    const cacheKey = `${query.artist}:${query.title}`.toLowerCase();

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    if (this.misses.has(cacheKey)) {
      return null;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const request = this.requestFromProviders(query, cacheKey);
    this.inFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async requestFromProviders(
    query: SearchQuery,
    cacheKey: string,
  ): Promise<Lyrics | null> {
    for (const provider of this.providers) {
      try {
        const result = await provider.fetchLyrics(query);
        if (result) {
          this.cache.set(cacheKey, result);
          return result.data;
        }
      } catch (error) {
        logger.error(`Provider ${provider.name} failed:`, {
          error: String(error),
        });
      }
    }

    this.misses.add(cacheKey);
    return null;
  }

  clearCache(): void {
    this.cache.clear();
    this.misses.clear();
  }
}
