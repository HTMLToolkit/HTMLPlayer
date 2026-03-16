import type { SearchQuery, ProviderResult } from "./base";

export interface AlbumArtResult {
  url: string;
  thumbnail: string;
  artist?: string;
  album?: string;
  source: string;
}

export interface AlbumArtProvider {
  name: string;
  fetchAlbumArt(query: SearchQuery): Promise<ProviderResult<AlbumArtResult[]> | null>;
  fetchArtistImage(artist: string): Promise<ProviderResult<string> | null>;
}
