import { BaseProvider, type SearchQuery, type ProviderResult } from "./base";
import type { AlbumArtProvider, AlbumArtResult } from "./albumArtTypes";

export class MusicBrainzProvider extends BaseProvider implements AlbumArtProvider {
  name = "MusicBrainz";
  private userAgent = "HTMLPlayer/2.0 (nellowtcs@gmail.com)";

  async fetchAlbumArt(query: SearchQuery): Promise<ProviderResult<AlbumArtResult[]> | null> {
    if (!query.artist || !query.album) {
      return null;
    }

    try {
      const searchResponse = await fetch(
        `https://musicbrainz.org/ws/2/release-group/?query=artist:${encodeURIComponent(query.artist)}%20AND%20release:${encodeURIComponent(query.album)}&fmt=json&limit=5`,
        { headers: { "User-Agent": this.userAgent } }
      );

      if (!searchResponse.ok) {
        return null;
      }

      const searchData = (await searchResponse.json()) as {
        release_groups?: { id: string; title: string }[];
      };

      if (!searchData.release_groups || searchData.release_groups.length === 0) {
        return null;
      }

      const results: AlbumArtResult[] = [];

      for (const release of searchData.release_groups.slice(0, 3)) {
        const coverUrl = `https://coverartarchive.org/release-group/${release.id}/front-250`;
        results.push({
          url: coverUrl,
          thumbnail: coverUrl,
          album: release.title,
          source: this.name,
        });
      }

      return {
        data: results,
        source: this.name,
        confidence: 0.8,
      };
    } catch (error) {
      console.error("MusicBrainz fetch error:", error);
      return null;
    }
  }

  async fetchArtistImage(artist: string): Promise<ProviderResult<string> | null> {
    if (!artist) {
      return null;
    }

    try {
      const searchResponse = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(artist)}&fmt=json&limit=1`,
        { headers: { "User-Agent": this.userAgent } }
      );

      if (!searchResponse.ok) {
        return null;
      }

      const searchData = (await searchResponse.json()) as {
        artists?: { id: string; name: string }[];
      };

      if (!searchData.artists || searchData.artists.length === 0) {
        return null;
      }

      const artistMbid = searchData.artists[0].id;

      const relResponse = await fetch(
        `https://musicbrainz.org/ws/2/artist/${artistMbid}?inc=url-rels&fmt=json`,
        { headers: { "User-Agent": this.userAgent } }
      );

      if (!relResponse.ok) {
        return null;
      }

      const relData = (await relResponse.json()) as {
        relations?: { type: string; url: { resource: string } }[];
      };

      const imageRel = relData.relations?.find(
        (r) => r.type === "image" && r.url?.resource
      );

      if (imageRel?.url?.resource) {
        return {
          data: imageRel.url.resource,
          source: this.name,
          confidence: 0.6,
        };
      }

      return null;
    } catch (error) {
      console.error("MusicBrainz artist image error:", error);
      return null;
    }
  }
}
