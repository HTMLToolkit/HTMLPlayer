import { BaseProvider, type SearchQuery, type ProviderResult } from "./base";
import type { Lyrics, LyricsProvider } from "./lyricsTypes";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("lyricsOvh");

export class LyricsOvhProvider extends BaseProvider implements LyricsProvider {
  name = "Lyrics.ovh";
  private baseUrl = "https://api.lyrics.ovh/v1";

  async fetchLyrics(
    query: SearchQuery,
  ): Promise<ProviderResult<Lyrics> | null> {
    if (!query.artist || !query.title) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${encodeURIComponent(query.artist)}/${encodeURIComponent(query.title)}`,
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { lyrics?: string };

      if (!data.lyrics) {
        return null;
      }

      const plain = data.lyrics
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      return {
        data: {
          synced: [],
          plain,
          source: this.name,
        },
        source: this.name,
        confidence: 0.7,
      };
    } catch (error) {
      logger.error("Lyrics.ovh fetch error:", { error: String(error) });
      return null;
    }
  }
}
