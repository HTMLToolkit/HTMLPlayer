import type { EmbeddedLyrics, EncodingDetails, GaplessInfo } from "../../core/engine/types";

export interface ExtractedMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  albumArt?: string;
  embeddedLyrics?: EmbeddedLyrics[];
  encoding?: EncodingDetails;
  gapless?: GaplessInfo;
}

export interface MetadataExtractor {
  extractMetadata(file: File | Blob): Promise<ExtractedMetadata>;
  extractAlbumArt(file: File | Blob): Promise<string | undefined>;
}

export abstract class BaseMetadataExtractor implements MetadataExtractor {
  abstract extractMetadata(file: File | Blob): Promise<ExtractedMetadata>;
  abstract extractAlbumArt(file: File | Blob): Promise<string | undefined>;

  protected getDefaultTitle(file: File): string {
    return file.name.replace(/\.[^/.]+$/, "");
  }
}