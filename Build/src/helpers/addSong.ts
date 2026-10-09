import type { Track, TrackSourceKind } from "../core/engine/types";
import { saveAudio } from "../platform/storage/opfs";
import { trackStorage } from "../platform/storage/trackStorage";

export interface ImportContext {
  sourceKind?: TrackSourceKind;
  sourceId?: string;
  path?: string;
}

export async function prepareAndStoreSong(
  song: Track,
  file: File,
): Promise<Track> {
  song.url = URL.createObjectURL(file);
  song.hasStoredAudio = true;
  await saveAudio(song.id, file);
  await trackStorage.saveTrack(song);
  return song;
}

export async function storeImportedSong(
  song: Track,
  file: File,
  context?: ImportContext,
): Promise<Track> {
  const sourcePath = context?.path ?? song.path;
  if (
    context?.sourceKind === "folderHandle" &&
    context.sourceId &&
    sourcePath
  ) {
    song.sourceKind = context.sourceKind;
    song.sourceId = context.sourceId;
    song.path = sourcePath;
    song.hasStoredAudio = true;
    song.url = "";
    await trackStorage.saveTrack(song);
    return song;
  }
  return prepareAndStoreSong(song, file);
}

export async function storeRemoteSong(song: Track): Promise<Track> {
  song.hasStoredAudio = false;
  await trackStorage.saveTrack(song);
  return song;
}
