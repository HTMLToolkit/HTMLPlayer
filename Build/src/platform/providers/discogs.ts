import { BaseProvider, type SearchQuery, type ProviderResult } from "./base";
import type { AlbumArtProvider, AlbumArtResult } from "./albumArtTypes";

export class DiscogsProvider extends BaseProvider implements AlbumArtProvider {
  name = "Discogs";
  private baseUrl = "https://api.discogs.com";
  private token: string | null = null;

  setToken(token: string): void {
    this.token = token;
  }

  async fetchAlbumArt(query: SearchQuery): Promise<ProviderResult<AlbumArtResult[]> | null> {
    if (!query.artist || !query.album) {
      return null;
    }

    try {
      const headers: Record<string, string> = {
        "User-Agent": "HTMLPlayer/2.0",
      };

      if (this.token) {
        headers["Authorization"] = `Discogs token=${this.token}`;
      }

      const response = await fetch(
        `${this.baseUrl}/database/search?q=${encodeURIComponent(query.artist)} ${encodeURIComponent(query.album)}&type=release&per_page=5`,
        { headers }
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        results?: { id: number; title: string; cover_image: string; thumb: string }[];
      };

      if (!data.results || data.results.length === 0) {
        return null;
      }

      const results: AlbumArtResult[] = data.results
        .filter((r) => r.cover_image)
        .slice(0, 3)
        .map((r) => ({
          url: r.cover_image,
          thumbnail: r.thumb,
          album: r.title,
          source: this.name,
        }));

      return {
        data: results,
        source: this.name,
        confidence: 0.75,
      };
    } catch (error) {
      console.error("Discogs fetch error:", error);
      return null;
    }
  }

  async fetchArtistImage(_artist: string): Promise<ProviderResult<string> | null> {
    return null;
  }
}
