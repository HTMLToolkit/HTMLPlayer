import { parseBlob, selectCover } from "music-metadata";
import type { ILyricsTag } from "music-metadata";

// Constants for missing metadata (will be translated in main thread)
const UNKNOWN_ARTIST = "__UNKNOWN_ARTIST__";
const UNKNOWN_ALBUM = "__UNKNOWN_ALBUM__";

interface BaseLyricsData {
  language?: string;
  description?: string;
}

interface SyncedLyricsData extends BaseLyricsData {
  synced: true;
  lines: Array<{
    text: string;
    timestamp: number; // in milliseconds
  }>;
}

interface UnsynchronizedLyricsData extends BaseLyricsData {
  synced: false;
  text: string;
}

type EmbeddedLyrics = SyncedLyricsData | UnsynchronizedLyricsData;

const LRC_TAG_IDS = new Set(["LYRICS", "LRC"]);

interface EncodingDetails {
  bitrate?: number;
  codec?: string;
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  container?: string;
  lossless?: boolean;
  profile?: string;
}

interface GaplessInfo {
  encoderDelay?: number;
  encoderPadding?: number;
}

/**
 * Compress album art to reduce memory usage
 * Skips compression for animated images (WebP, GIF) to preserve animation
 */
async function compressAlbumArt(base64: string, maxSize = 400): Promise<string> {
  // Check if it's an animated format
  const isAnimatedFormat = base64.startsWith('data:image/webp') || 
                          base64.startsWith('data:image/gif');
  
  if (isAnimatedFormat) {
    console.log('Skipping compression for animated image');
    return base64; // Return original to preserve animation
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onerror = () => reject(new Error('Failed to load image'));
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Resize if too large (maintain aspect ratio)
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height / width) * maxSize);
          width = maxSize;
        } else {
          width = Math.round((width / height) * maxSize);
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Compress to JPEG at 85% quality
      const compressed = canvas.toDataURL('image/jpeg', 0.85);
      
      console.log(`Album art compressed: ${(base64.length / 1024).toFixed(1)}KB → ${(compressed.length / 1024).toFixed(1)}KB`);
      
      resolve(compressed);
    };
    
    img.src = base64;
  });
}

function mapLyricsTag(
  tag: ILyricsTag | undefined | null,
): EmbeddedLyrics | null {
  if (!tag) return null;

  const description = tag.descriptor?.trim() || undefined;
  const language = tag.language?.trim() || undefined;

  if (Array.isArray(tag.syncText) && tag.syncText.length > 0) {
    const lines = tag.syncText
      .filter(
        (entry) =>
          typeof entry.text === "string" && entry.text.trim().length > 0,
      )
      .map((entry) => ({
        text: entry.text.trim(),
        timestamp:
          typeof entry.timestamp === "number" &&
            Number.isFinite(entry.timestamp)
            ? entry.timestamp
            : 0,
      }));

    if (lines.length === 0) {
      return null;
    }

    lines.sort((a, b) => a.timestamp - b.timestamp);

    return {
      synced: true,
      lines,
      language,
      description,
    };
  }

  if (typeof tag.text === "string" && tag.text.trim().length > 0) {
    return {
      synced: false,
      text: tag.text,
      language,
      description,
    };
  }

  return null;
}

function parseLrcValue(lrc: string): EmbeddedLyrics | null {
  const lines: Array<{ text: string; timestamp: number }> = [];
  let hasTimestamps = false;

  const rows = lrc.split(/\r?\n/);
  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed) {
      continue;
    }

    const tagMatches = [
      ...trimmed.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g),
    ];
    let text = trimmed
      .replace(/\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g, "")
      .trim();

    if (tagMatches.length > 0) {
      hasTimestamps = true;
      if (!text) {
        text = "";
      }

      for (const match of tagMatches) {
        const minutes = Number.parseInt(match[1] ?? "0", 10);
        const seconds = Number.parseInt(match[2] ?? "0", 10);
        const fraction = (match[3] ?? "").padEnd(3, "0");
        const milliseconds = Number.parseInt(fraction, 10) || 0;
        const timestamp = (minutes * 60 + seconds) * 1000 + milliseconds;
        lines.push({ text, timestamp });
      }
    } else {
      lines.push({
        text: trimmed,
        timestamp: lines.length > 0 ? lines[lines.length - 1].timestamp : 0,
      });
    }
  }

  if (hasTimestamps && lines.length > 0) {
    lines.sort((a, b) => a.timestamp - b.timestamp);
    return { synced: true, lines };
  }

  const textContent = rows.join("\n").trim();
  if (textContent.length > 0) {
    return { synced: false, text: textContent };
  }

  return null;
}

function normaliseTagValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(value);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value) && value.length > 0) {
    return normaliseTagValue(value[0]);
  }
  return null;
}

function parseItunesGapless(value: unknown): GaplessInfo | null {
  const raw = normaliseTagValue(value);
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const hexMatches = cleaned.match(/[0-9A-Fa-f]{8}/g);
  if (!hexMatches || hexMatches.length < 3) return null;

  const delayHex = hexMatches[1];
  const paddingHex = hexMatches[2];

  const encoderDelay = Number.parseInt(delayHex, 16);
  const encoderPadding = Number.parseInt(paddingHex, 16);

  if (!Number.isFinite(encoderDelay) && !Number.isFinite(encoderPadding)) {
    return null;
  }

  const result: GaplessInfo = {};
  if (Number.isFinite(encoderDelay) && encoderDelay > 0) {
    result.encoderDelay = encoderDelay;
  }
  if (Number.isFinite(encoderPadding) && encoderPadding > 0) {
    result.encoderPadding = encoderPadding;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function mergeGaplessInfo(
  base: GaplessInfo | undefined,
  extra: GaplessInfo | null,
): GaplessInfo | undefined {
  if (!base && !extra) return undefined;
  const result: GaplessInfo = {};
  if (base?.encoderDelay !== undefined) result.encoderDelay = base.encoderDelay;
  if (base?.encoderPadding !== undefined)
    result.encoderPadding = base.encoderPadding;
  if (extra?.encoderDelay !== undefined)
    result.encoderDelay = extra.encoderDelay;
  if (extra?.encoderPadding !== undefined)
    result.encoderPadding = extra.encoderPadding;
  return Object.keys(result).length > 0 ? result : undefined;
}

// Worker receives file and processes metadata
self.onmessage = async (event: MessageEvent) => {
  const { file, fileName } = event.data;

  try {
    const metadata = await parseBlob(file, {
      skipCovers: false,
      duration: true,
    });

    const warnings: string[] = [];

    let albumArt: string | undefined = undefined;
    const cover = selectCover(metadata.common.picture);
    if (cover && cover.data.length > 0) {
      const blob = new Blob([new Uint8Array(cover.data)], {
        type: cover.format,
      });

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read album art"));
        reader.readAsDataURL(blob);
      });

      // Compress before sending back to main thread
      try {
        albumArt = await compressAlbumArt(base64);
      } catch (error) {
        console.warn('Worker: Failed to compress album art:', error);
        albumArt = base64; // Fallback to original
      }
    }

    const parserWarnings = (metadata.quality?.warnings ?? [])
      .map((warning) => {
        if (typeof warning === "string") return warning;
        if (warning && typeof warning.message === "string")
          return warning.message;
        return JSON.stringify(warning);
      })
      .filter(
        (message) => typeof message === "string" && message.trim().length > 0,
      );

    warnings.push(...parserWarnings);

    const embeddedLyrics: EmbeddedLyrics[] = [];
    const seenLyrics = new Set<string>();

    const addLyrics = (lyrics: EmbeddedLyrics | null) => {
      if (!lyrics) return;

      const key = lyrics.synced
        ? `synced:${lyrics.lines.map((line) => `${line.timestamp}:${line.text}`).join("|")}`
        : `plain:${lyrics.text}`;

      if (seenLyrics.has(key)) return;
      seenLyrics.add(key);
      embeddedLyrics.push(lyrics);
    };

    for (const tag of metadata.common.lyrics ?? []) {
      addLyrics(mapLyricsTag(tag));
    }

    const vorbisTags = metadata.native?.vorbis ?? [];
    for (const tag of vorbisTags) {
      const tagId = typeof tag.id === "string" ? tag.id.toUpperCase() : "";
      if (!LRC_TAG_IDS.has(tagId)) continue;
      if (typeof tag.value !== "string" || tag.value.trim().length === 0)
        continue;

      const lrcLyrics = parseLrcValue(tag.value);
      if (lrcLyrics) {
        addLyrics(lrcLyrics);
      }
    }

    const encodingDetails: EncodingDetails = {
      bitrate: metadata.format.bitrate ?? undefined,
      codec: metadata.format.codec ?? undefined,
      sampleRate: metadata.format.sampleRate ?? undefined,
      channels: metadata.format.numberOfChannels ?? undefined,
      bitsPerSample: metadata.format.bitsPerSample ?? undefined,
      container: metadata.format.container ?? undefined,
      lossless: metadata.format.lossless ?? undefined,
      profile: metadata.format.codecProfile ?? undefined,
    };

    let gaplessInfo: GaplessInfo | undefined;

    const formatExtra = metadata.format as unknown as Record<string, unknown>;
    const encoderDelay =
      typeof formatExtra.encoderDelay === "number"
        ? formatExtra.encoderDelay
        : undefined;
    if (
      typeof encoderDelay === "number" &&
      Number.isFinite(encoderDelay) &&
      encoderDelay > 0
    ) {
      gaplessInfo = { ...(gaplessInfo ?? {}), encoderDelay };
    }

    const encoderPadding =
      typeof formatExtra.encoderPadding === "number"
        ? formatExtra.encoderPadding
        : undefined;
    if (
      typeof encoderPadding === "number" &&
      Number.isFinite(encoderPadding) &&
      encoderPadding > 0
    ) {
      gaplessInfo = { ...(gaplessInfo ?? {}), encoderPadding };
    }

    for (const tagList of Object.values(metadata.native ?? {})) {
      for (const tag of tagList ?? []) {
        const id = typeof tag.id === "string" ? tag.id.toUpperCase() : "";

        if (id === "ITUNSMPB" || id.endsWith(":ITUNSMPB")) {
          const parsed = parseItunesGapless(tag.value);
          gaplessInfo = mergeGaplessInfo(gaplessInfo, parsed);
          continue;
        }

        if (
          id === "MP4:----:COM.APPLE.ITUNES:ITUNSMPB" ||
          id === "----:COM.APPLE.ITUNES:ITUNSMPB"
        ) {
          const parsed = parseItunesGapless(tag.value);
          gaplessInfo = mergeGaplessInfo(gaplessInfo, parsed);
        }
      }
    }

    const result = {
      title:
        metadata.common.title && typeof metadata.common.title === "string"
          ? metadata.common.title
          : fileName.replace(/\.[^/.]+$/, ""),
      artist:
        metadata.common.artist && typeof metadata.common.artist === "string"
          ? metadata.common.artist
          : UNKNOWN_ARTIST,
      album:
        metadata.common.album && typeof metadata.common.album === "string"
          ? metadata.common.album
          : UNKNOWN_ALBUM,
      duration: metadata.format.duration ?? 0,
      embeddedLyrics: embeddedLyrics.length > 0 ? embeddedLyrics : undefined,
      encoding: Object.values(encodingDetails).some(
        (value) => value !== undefined,
      )
        ? encodingDetails
        : undefined,
      gapless: gaplessInfo,
    };

    self.postMessage({ metadata: result, albumArt, warnings });
  } catch (e) {
    self.postMessage({
      error: `Failed to process metadata for ${fileName}: ${e}`,
    });
  }
};
