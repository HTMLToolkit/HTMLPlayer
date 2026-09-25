import { BaseMetadataExtractor } from "./base";
import type { ExtractedMetadata, MetadataExtractor } from "./base";
import { createLogger } from "../../helpers/logger";
import initFlo, { info as floInfo } from "@audiflo/libflo";

const logger = createLogger("floMetadata");

interface FloAudioInfo {
  artist?: string;
  album?: string;
  sample_rate?: number;
  channels?: number;
  bit_depth?: number;
}

export class FloMetadataExtractor extends BaseMetadataExtractor {
  private initPromise: Promise<unknown> | null = null;

  private ensureInitialized(): Promise<unknown> {
    if (!this.initPromise) {
      this.initPromise = initFlo().catch((error) => {
        this.initPromise = null;
        logger.error("Failed to initialize flo decoder:", {
          error: String(error),
        });
        throw error;
      });
    }
    return this.initPromise;
  }

  async extractMetadata(file: File | Blob): Promise<ExtractedMetadata> {
    await this.ensureInitialized();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Flo = new Uint8Array(arrayBuffer);

      const info = floInfo(uint8Flo) as FloAudioInfo;
      const duration = this.calculateDuration(info, arrayBuffer.byteLength);

      return {
        title: this.getDefaultTitle(file as File),
        artist: info.artist || "Unknown Artist",
        album: info.album || "Unknown Album",
        duration,
        encoding: {
          sampleRate: info.sample_rate || 44100,
          channels: info.channels || 2,
          bitsPerSample: info.bit_depth || 16,
          lossless: true,
        },
      };
    } catch (error) {
      logger.error("Failed to extract flo metadata:", { error: String(error) });
      return {
        title: this.getDefaultTitle(file as File),
        artist: "Unknown Artist",
        album: "Unknown Album",
        duration: 0,
      };
    }
  }

  private calculateDuration(info: FloAudioInfo, byteLength: number): number {
    const sampleRate = info.sample_rate;
    const channels = info.channels;
    const bitDepth = info.bit_depth;

    if (!sampleRate || !channels || !bitDepth) {
      return 0;
    }

    const bytesPerSample = bitDepth / 8;
    const totalSamples = byteLength / bytesPerSample;
    return totalSamples / (sampleRate * channels);
  }

  async extractAlbumArt(_file: File | Blob): Promise<string | undefined> {
    return undefined;
  }
}

export function createFloMetadataExtractor(): MetadataExtractor {
  return new FloMetadataExtractor();
}
