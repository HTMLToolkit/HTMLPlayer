import { BaseMetadataExtractor } from "./base";
import type { ExtractedMetadata, MetadataExtractor } from "./base";
import type {
  EmbeddedLyrics,
  EncodingDetails,
  GaplessInfo,
} from "../../core/engine/types";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("musicMetadata");

export class MusicMetadataExtractor extends BaseMetadataExtractor {
  async extractMetadata(file: File | Blob): Promise<ExtractedMetadata> {
    try {
      const musicMetadata = await import("music-metadata");
      const metadata = await musicMetadata.parseBlob(file);

      const common = metadata.common;
      const format = metadata.format;

      let albumArt: string | undefined;
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        const uint8Array = new Uint8Array(pic.data);
        const blob = new Blob([uint8Array], { type: pic.format });
        albumArt = URL.createObjectURL(blob);
      }

      const embeddedLyrics: EmbeddedLyrics[] = [];

      if (common.lyrics) {
        for (const lyric of common.lyrics) {
          embeddedLyrics.push({
            synced:
              ((lyric as unknown as Record<string, unknown>)
                .synced as boolean) || false,
            language:
              ((lyric as unknown as Record<string, unknown>).lang as string) ||
              undefined,
            description:
              ((lyric as unknown as Record<string, unknown>)
                .descriptor as string) || undefined,
            text: lyric.text,
          });
        }
      }

      const encoding: EncodingDetails = {
        bitrate: format.bitrate,
        codec: format.codec,
        sampleRate: format.sampleRate,
        channels: format.numberOfChannels,
        bitsPerSample: format.bitsPerSample,
        container: format.container,
        lossless: format.lossless,
        profile: format.codecProfile,
      };

      const gapless: GaplessInfo = {};
      if (
        (format as unknown as Record<string, unknown>).encoderDelay !==
        undefined
      ) {
        gapless.encoderDelay = (format as unknown as Record<string, unknown>)
          .encoderDelay as number;
      }
      if (
        (format as unknown as Record<string, unknown>).encoderPadding !==
        undefined
      ) {
        gapless.encoderPadding = (format as unknown as Record<string, unknown>)
          .encoderPadding as number;
      }

      return {
        title: common.title || this.getDefaultTitle(file as File),
        artist: common.artist || "Unknown Artist",
        album: common.album || "Unknown Album",
        duration: metadata.format.duration || 0,
        albumArt,
        embeddedLyrics: embeddedLyrics.length > 0 ? embeddedLyrics : undefined,
        encoding,
        gapless: Object.keys(gapless).length > 0 ? gapless : undefined,
      };
    } catch (error) {
      logger.error("Failed to extract metadata:", { error: String(error) });
      return {
        title: this.getDefaultTitle(file as File),
        artist: "Unknown Artist",
        album: "Unknown Album",
        duration: 0,
      };
    }
  }

  async extractAlbumArt(file: File | Blob): Promise<string | undefined> {
    try {
      const musicMetadata = await import("music-metadata");
      const metadata = await musicMetadata.parseBlob(file);

      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        const uint8Array = new Uint8Array(pic.data);
        const blob = new Blob([uint8Array], { type: pic.format });
        return URL.createObjectURL(blob);
      }
    } catch (error) {
      logger.error("Failed to extract album art:", { error: String(error) });
    }
    return undefined;
  }
}

export function createMetadataExtractor(): MetadataExtractor {
  return new MusicMetadataExtractor();
}
