import type { SearchQuery, ProviderResult } from "./base";
import type { Lyrics, LyricsProvider } from "./lyricsTypes";

export class LyricsManager {
  private providers: LyricsProvider[] = [];
  private cache: Map<string, ProviderResult<Lyrics>> = new Map();

  addProvider(provider: LyricsProvider): void {
    this.providers.push(provider);
  }

  async fetchLyrics(query: SearchQuery): Promise<Lyrics | null> {
    const cacheKey = `${query.artist}:${query.title}`.toLowerCase();

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    for (const provider of this.providers) {
      try {
        const result = await provider.fetchLyrics(query);
        if (result) {
          this.cache.set(cacheKey, result);
          return result.data;
        }
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
      }
    }

    return null;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
