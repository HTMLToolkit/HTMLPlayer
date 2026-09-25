import { BaseMetadataExtractor } from "./base";
import type { ExtractedMetadata, MetadataExtractor } from "./base";
import type {
  EmbeddedLyrics,
  EncodingDetails,
  GaplessInfo,
  ReplayGainInfo,
} from "../../core/engine/types";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("musicMetadata");

interface ReplayGainRatio {
  ratio?: number;
  dB?: number;
}

function ratioDb(value: ReplayGainRatio | undefined): number | undefined {
  return typeof value?.dB === "number" && Number.isFinite(value.dB)
    ? value.dB
    : undefined;
}

function ratioValue(value: ReplayGainRatio | undefined): number | undefined {
  if (typeof value?.ratio === "number" && Number.isFinite(value.ratio)) {
    return value.ratio;
  }
  return typeof value?.dB === "number" && Number.isFinite(value.dB)
    ? value.dB
    : undefined;
}

export class MusicMetadataExtractor extends BaseMetadataExtractor {
  async extractMetadata(file: File | Blob): Promise<ExtractedMetadata> {
    try {
      const musicMetadata = await import("music-metadata");
      const metadata = await musicMetadata.parseBlob(file);

      const common = metadata.common;
      const format = metadata.format;

      let albumArt: string | undefined;
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0]!;
        const uint8Array = new Uint8Array(pic.data);
        const blob = new Blob([uint8Array], { type: pic.format });
        albumArt = URL.createObjectURL(blob);
      }

      const embeddedLyrics: EmbeddedLyrics[] = [];

      if (common.lyrics) {
        for (const lyric of common.lyrics) {
          const raw = lyric as unknown as {
            synced?: boolean;
            lang?: string;
            descriptor?: string;
            text?: string;
            lines?: Array<{ text?: string; time?: number }>;
            syncText?: Array<{ text?: string; timestamp?: number }>;
          };

          const timed =
            Array.isArray(raw.syncText) && raw.syncText.length > 0
              ? raw.syncText
              : Array.isArray(raw.lines) && raw.lines.length > 0
                ? raw.lines.map((line) => ({
                    text: line.text,
                    timestamp:
                      typeof line.time === "number" &&
                      Number.isFinite(line.time)
                        ? line.time * 1000
                        : undefined,
                  }))
                : [];

          const lines = timed
            .filter(
              (entry) =>
                typeof entry.text === "string" && entry.text.trim().length > 0,
            )
            .map((entry) => ({
              text: (entry.text ?? "").trim(),
              timestamp:
                typeof entry.timestamp === "number" &&
                Number.isFinite(entry.timestamp)
                  ? entry.timestamp
                  : 0,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

          if (lines.length > 0) {
            embeddedLyrics.push({
              synced: true,
              lines,
              language: raw.lang || undefined,
              description: raw.descriptor || undefined,
            });
          } else if (
            typeof raw.text === "string" &&
            raw.text.trim().length > 0
          ) {
            embeddedLyrics.push({
              synced: raw.synced || false,
              text: raw.text,
              language: raw.lang || undefined,
              description: raw.descriptor || undefined,
            });
          }
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

      const replayGain: ReplayGainInfo = {};
      const record = common as unknown as Record<string, ReplayGainRatio>;
      const trackGain = ratioDb(record.replaygain_track_gain);
      const albumGain = ratioDb(record.replaygain_album_gain);
      const trackPeak = ratioValue(record.replaygain_track_peak);
      const albumPeak = ratioValue(record.replaygain_album_peak);
      const referenceLoudness = ratioDb(record.replaygain_reference_loudness);

      if (trackGain !== undefined) replayGain.trackGain = trackGain;
      if (albumGain !== undefined) replayGain.albumGain = albumGain;
      if (trackPeak !== undefined) replayGain.trackPeak = trackPeak;
      if (albumPeak !== undefined) replayGain.albumPeak = albumPeak;
      if (referenceLoudness !== undefined) {
        replayGain.referenceLoudness = referenceLoudness;
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
        replayGain: Object.keys(replayGain).length > 0 ? replayGain : undefined,
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
        const pic = metadata.common.picture[0]!;
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
