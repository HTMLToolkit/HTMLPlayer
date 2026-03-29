import type { Track } from "../../core/engine/types";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("duplicateDetector");

export interface DuplicateGroup {
  representative: Track;
  duplicates: Track[];
}

export class DuplicateDetector {
  private hashCache: Map<string, string> = new Map();

  async computeHash(file: Blob): Promise<string> {
    const buffer = await file.arrayBuffer();
    let hash = 0;

    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i++) {
      hash = ((hash << 5) - hash + view[i]) | 0;
    }

    return hash.toString(16);
  }

  async computePartialHash(
    file: Blob,
    sampleSize = 1024 * 1024,
  ): Promise<string> {
    const buffer = await file.slice(0, sampleSize).arrayBuffer();
    let hash = 0;

    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i++) {
      hash = ((hash << 5) - hash + view[i]) | 0;
    }

    return hash.toString(16);
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
        logger.error(`Failed to hash track ${track.id}:`, { error: String(error) });
      }
    }

    const duplicates: DuplicateGroup[] = [];

    for (const [_hash, trackGroup] of hashToTracks) {
      if (trackGroup.length > 1) {
        duplicates.push({
          representative: trackGroup[0],
          duplicates: trackGroup.slice(1),
        });
      }
    }

    return duplicates;
  }

  findDuplicatesByMetadata(tracks: Track[]): DuplicateGroup[] {
    const signatureToTracks: Map<string, Track[]> = new Map();

    for (const track of tracks) {
      const signature = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}|${track.album.toLowerCase()}`;
      const existing = signatureToTracks.get(signature) || [];
      existing.push(track);
      signatureToTracks.set(signature, existing);
    }

    const duplicates: DuplicateGroup[] = [];

    for (const [_signature, trackGroup] of signatureToTracks) {
      if (trackGroup.length > 1) {
        duplicates.push({
          representative: trackGroup[0],
          duplicates: trackGroup.slice(1),
        });
      }
    }

    return duplicates;
  }

  clearCache(): void {
    this.hashCache.clear();
  }
}

export function createDuplicateDetector(): DuplicateDetector {
  return new DuplicateDetector();
}
