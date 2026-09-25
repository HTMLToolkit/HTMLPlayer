import type { Track } from "../core/engine/types";
import { trackStorage } from "../platform/storage/trackStorage";

export async function prepareAndStoreSong(
  song: Track,
  file: File,
): Promise<Track> {
  song.url = URL.createObjectURL(file);
  song.hasStoredAudio = true;
  const arrayBuffer = await file.arrayBuffer();
  await trackStorage.saveTrack(song, arrayBuffer);
  return song;
}
