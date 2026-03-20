import { BaseMetadataExtractor } from "./base";
import type { ExtractedMetadata, MetadataExtractor } from "./base";

interface FloAudioInfo {
  artist?: string;
  album?: string;
  sample_rate?: number;
  channels?: number;
  bit_depth?: number;
}

export class FloMetadataExtractor extends BaseMetadataExtractor {
  private floDecoder: typeof import("@flo-audio/libflo-audio") | null = null;
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.floDecoder) return;

    try {
      const flo = await import("@flo-audio/libflo-audio");
      await flo.default();
      this.floDecoder = flo;
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize flo decoder:", error);
      throw error;
    }
  }

  async extractMetadata(file: File | Blob): Promise<ExtractedMetadata> {
    await this.ensureInitialized();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Flo = new Uint8Array(arrayBuffer);

      const info = this.floDecoder!.info(uint8Flo) as FloAudioInfo;
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
      console.error("Failed to extract flo metadata:", error);
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
