import type {
  EmbeddedLyrics,
  EncodingDetails,
  GaplessInfo,
} from "../../core/engine/types";

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

export async function compressAlbumArt(
  base64: string,
  maxSize = 200,
): Promise<string> {
  const isAnimatedFormat =
    base64.startsWith("data:image/webp") || base64.startsWith("data:image/gif");

  if (isAnimatedFormat) {
    return base64;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onerror = () => reject(new Error("Failed to load image"));

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

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
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", 0.7);

      canvas.width = 0;
      canvas.height = 0;

      resolve(compressed);
    };

    img.src = base64;
  });
}
