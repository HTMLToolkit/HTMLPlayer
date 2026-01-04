import * as flo from "@flo-audio/libflo-audio";
import initFlo from "@flo-audio/libflo-audio";

let floInitialized = false;
async function ensureFloInitialized() {
  if (!floInitialized) {
    await initFlo();
    floInitialized = true;
  }
}

// Decode a .flo file buffer to AudioBuffer using @flo-audio/libflo
export async function decodeFloToAudioBuffer(
  floData: ArrayBuffer,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  const samples = flo.decode(uint8Flo);
  const fileInfo = flo.info(uint8Flo);
  const { channels, sample_rate } = fileInfo;
  const length = samples.length / channels;
  const audioBuffer = audioContext.createBuffer(channels, length, sample_rate);
  // Deinterleave
  for (let ch = 0; ch < channels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      channelData[i] = samples[i * channels + ch];
    }
  }
  return audioBuffer;
}

// Get FLO file info (sample rate, channels, bit depth, duration, etc)
export async function getFloInfo(floData: ArrayBuffer): Promise<any> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.info(uint8Flo);
}

// Validate FLO file integrity (CRC32)
export async function validateFlo(floData: ArrayBuffer): Promise<boolean> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.validate(uint8Flo);
}

// Extract metadata as JS object (title, artist, album, etc)
export async function getFloMetadata(
  floData: ArrayBuffer,
): Promise<any | null> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.get_metadata(uint8Flo);
}

// Extract cover art (returns { mime_type, data })
export async function getFloCoverArt(
  floData: ArrayBuffer,
): Promise<{ mime_type: string; data: Uint8Array } | null> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.get_cover_art(uint8Flo);
}

// Extract synchronized lyrics (returns array or null)
export async function getFloSyncedLyrics(
  floData: ArrayBuffer,
): Promise<Array<{ timestamp_ms: number; text: string }> | null> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.get_synced_lyrics(uint8Flo);
}

// Create FLO metadata from JS object (returns Uint8Array)
export async function createFloMetadataFromObject(
  obj: any,
): Promise<Uint8Array> {
  await ensureFloInitialized();
  return flo.create_metadata_from_object(obj);
}
