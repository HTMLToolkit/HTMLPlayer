import { BaseMetadataExtractor } from "./base";
import type { ExtractedMetadata, MetadataExtractor } from "./base";
import { createLogger } from "../../helpers/logger";
import initFlo, {
  info as floInfo,
  get_metadata as floGetMetadata,
  get_cover_art as floGetCoverArt,
} from "@audiflo/libflo";

const logger = createLogger("floMetadata");

const BASE64_CHUNK_SIZE = 0x8000;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
};

interface FloAudioInfo {
  sample_rate: number;
  channels: number;
  bit_depth: number;
  duration_secs: number;
  total_samples: bigint;
}

interface FloTags {
  title?: string;
  artist?: string;
  album?: string;
}

export interface FloCoverArt {
  mime_type: string;
  data: Uint8Array;
}

export interface FloLibApi {
  init(): Promise<unknown>;
  info(data: Uint8Array): FloAudioInfo;
  getMetadata(data: Uint8Array): FloTags | null;
  getCoverArt(data: Uint8Array): FloCoverArt | null;
}

const realFloLib: FloLibApi = {
  init: initFlo,
  info: (data) => floInfo(data) as FloAudioInfo,
  getMetadata: (data) => floGetMetadata(data) as FloTags | null,
  getCoverArt: (data) => floGetCoverArt(data) as FloCoverArt | null,
};

export class FloMetadataExtractor extends BaseMetadataExtractor {
  private initPromise: Promise<unknown> | null = null;
  private readonly flo: FloLibApi;

  constructor(flolib: FloLibApi = realFloLib) {
    super();
    this.flo = flolib;
  }

  private ensureInitialized(): Promise<unknown> {
    if (!this.initPromise) {
      this.initPromise = this.flo.init().catch((error) => {
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

      const audioInfo = this.flo.info(uint8Flo);
      const tags = this.flo.getMetadata(uint8Flo);
      const cover = this.flo.getCoverArt(uint8Flo);
      const duration = this.calculateDuration(
        audioInfo,
        arrayBuffer.byteLength,
      );

      let albumArt: string | undefined;
      if (cover?.data.length && cover.mime_type.startsWith("image/")) {
        albumArt = `data:${cover.mime_type};base64,${bytesToBase64(cover.data)}`;
      }

      return {
        title: tags?.title || this.getDefaultTitle(file as File),
        artist: tags?.artist || "Unknown Artist",
        album: tags?.album || "Unknown Album",
        duration,
        albumArt,
        encoding: {
          sampleRate: audioInfo.sample_rate || 44100,
          channels: audioInfo.channels || 2,
          bitsPerSample: audioInfo.bit_depth || 16,
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
    if (info.duration_secs > 0) {
      return info.duration_secs;
    }

    if (info.total_samples > 0 && info.sample_rate > 0) {
      return Number(info.total_samples) / info.sample_rate;
    }

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
