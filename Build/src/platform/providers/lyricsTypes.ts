import type { SearchQuery, ProviderResult } from "./base";

export interface LyricsLine {
  time: number;
  text: string;
}

export interface Lyrics {
  synced: LyricsLine[];
  plain: string[];
  source: string;
}

export interface LyricsProvider {
  name: string;
  fetchLyrics(query: SearchQuery): Promise<ProviderResult<Lyrics> | null>;
}
