import type { Track } from "../../core/engine/types";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("duplicateDetector");

export interface DuplicateGroup {
  representative: Track;
  duplicates: Track[];
}

export function trackSignature(song: {
  title: string;
  artist: string;
  album: string;
}): string {
  return `${song.title.toLowerCase()}|${song.artist.toLowerCase()}|${song.album.toLowerCase()}`;
}

export class DuplicateDetector {
  private async computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
    if (
      !("crypto" in globalThis) ||
      !globalThis.crypto ||
      !globalThis.crypto.subtle
    ) {
      throw new Error("Web Crypto API is not available to compute file hash.");
    }

    const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    const bytes = new Uint8Array(digest);

    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += (bytes[i] ?? 0).toString(16).padStart(2, "0");
    }

    return hex;
  }

  private async readBlob(blob: Blob): Promise<ArrayBuffer> {
    if (typeof blob.arrayBuffer === "function") {
      return blob.arrayBuffer();
    }

    const reader = new FileReader();
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () =>
        reject(reader.error ?? new Error("Failed to read blob"));
      reader.readAsArrayBuffer(blob);
    });
  }

  async computeHash(file: Blob): Promise<string> {
    return this.computeSha256Hex(await this.readBlob(file));
  }

  async computePartialHash(
    file: Blob,
    sampleSize = 1024 * 1024,
  ): Promise<string> {
    return this.computeSha256Hex(
      await this.readBlob(file.slice(0, sampleSize)),
    );
  }

  async findDuplicates(
    tracks: Track[],
    usePartial = true,
  ): Promise<DuplicateGroup[]> {
    const hashToTracks: Map<string, Track[]> = new Map();

    for (const track of tracks) {
      if (!track.url.startsWith("blob:")) {
        continue;
      }

      try {
        const response = await fetch(track.url);
        const blob = await response.blob();

        const hash = usePartial
          ? await this.computePartialHash(blob)
          : await this.computeHash(blob);

        const existing = hashToTracks.get(hash) || [];
        existing.push(track);
        hashToTracks.set(hash, existing);
      } catch (error) {
        logger.error(`Failed to hash track ${track.id}:`, {
          error: String(error),
        });
      }
    }

    const duplicates: DuplicateGroup[] = [];

    for (const [_hash, trackGroup] of hashToTracks) {
      if (trackGroup.length > 1) {
        duplicates.push({
          representative: trackGroup[0]!,
          duplicates: trackGroup.slice(1),
        });
      }
    }

    return duplicates;
  }

  async isConfirmedDuplicate(
    file: Blob,
    song: Pick<Track, "title" | "artist" | "album">,
    candidates: Track[],
    usePartial = true,
  ): Promise<boolean> {
    const signature = trackSignature(song);

    for (const track of candidates) {
      if (trackSignature(track) !== signature) continue;
      if (!track.url.startsWith("blob:")) continue;

      try {
        const existingBlob = await (await fetch(track.url)).blob();
        const fileHash = usePartial
          ? await this.computePartialHash(file)
          : await this.computeHash(file);
        const existingHash = usePartial
          ? await this.computePartialHash(existingBlob)
          : await this.computeHash(existingBlob);
        if (fileHash === existingHash) return true;
      } catch (error) {
        logger.error(`Failed to hash existing track ${track.id}:`, {
          error: String(error),
        });
      }
    }

    return false;
  }

  findDuplicatesByMetadata(tracks: Track[]): DuplicateGroup[] {
    const signatureToTracks: Map<string, Track[]> = new Map();

    for (const track of tracks) {
      const signature = trackSignature(track);
      const existing = signatureToTracks.get(signature) || [];
      existing.push(track);
      signatureToTracks.set(signature, existing);
    }

    const duplicates: DuplicateGroup[] = [];

    for (const [_signature, trackGroup] of signatureToTracks) {
      if (trackGroup.length > 1) {
        duplicates.push({
          representative: trackGroup[0]!,
          duplicates: trackGroup.slice(1),
        });
      }
    }

    return duplicates;
  }
}

export function createDuplicateDetector(): DuplicateDetector {
  return new DuplicateDetector();
}
