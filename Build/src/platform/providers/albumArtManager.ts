import type { SearchQuery } from "./base";
import type { AlbumArtProvider, AlbumArtResult } from "./albumArtTypes";

export class AlbumArtManager {
  private providers: AlbumArtProvider[] = [];
  private cache: Map<string, AlbumArtResult> = new Map();

  addProvider(provider: AlbumArtProvider): void {
    this.providers.push(provider);
  }

  async fetchAlbumArt(query: SearchQuery): Promise<AlbumArtResult | null> {
    const cacheKey = `${query.artist}:${query.album}`.toLowerCase();

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    for (const provider of this.providers) {
      try {
        const result = await provider.fetchAlbumArt(query);
        if (result && result.data.length > 0) {
          const best = result.data[0];
          this.cache.set(cacheKey, best);
          return best;
        }
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
      }
    }

    return null;
  }

  async fetchArtistImage(artist: string): Promise<string | null> {
    if (!artist) return null;

    for (const provider of this.providers) {
      try {
        const result = await provider.fetchArtistImage(artist);
        if (result) {
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

export function createAlbumArtManager(): AlbumArtManager {
  const manager = new AlbumArtManager();
  return manager;
}
