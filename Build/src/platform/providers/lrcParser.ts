import { BaseProvider, type SearchQuery, type ProviderResult } from "./base";
import type { Lyrics, LyricsLine, LyricsProvider } from "./lyricsTypes";

export class LRCLyricsProvider extends BaseProvider implements LyricsProvider {
  name = "LRC Parser";

  async fetchLyrics(_query: SearchQuery): Promise<ProviderResult<Lyrics> | null> {
    return null;
  }

  parseLRC(lrcContent: string): Lyrics {
    const synced: LyricsLine[] = [];
    const plain: string[] = [];

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    const lines = lrcContent.split("\n");

    for (const line of lines) {
      const times: number[] = [];
      let match;

      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
        times.push(minutes * 60 + seconds + milliseconds / 1000);
      }

      const text = line.replace(timeRegex, "").trim();
      if (text) {
        plain.push(text);
        for (const time of times) {
          synced.push({ time, text });
        }
      }
    }

    synced.sort((a, b) => a.time - b.time);

    return {
      synced,
      plain,
      source: "LRC",
    };
  }
}
