// floProcessor.ts - Fixed flo audio processing
import initFlo, * as flo from "@flo-audio/libflo-audio";

let floInitialized = false;

async function ensureFloInitialized() {
  if (!floInitialized) {
    await initFlo();
    floInitialized = true;
  }
}

// Decode a .flo file buffer to AudioBuffer using @flo-audio/libflo-audio
export async function decodeFloToAudioBuffer(
  floData: ArrayBuffer,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  await ensureFloInitialized();
  
  const uint8Flo = new Uint8Array(floData);
  
  // Decode flo to interleaved Float32Array samples
  const samples = flo.decode(uint8Flo);
  
  // Get file info for audio properties
  const fileInfo = flo.info(uint8Flo);
  const { channels, sample_rate } = fileInfo;
  
  // Calculate number of frames
  const frameCount = samples.length / channels;
  
  // Create AudioBuffer
  const audioBuffer = audioContext.createBuffer(
    channels,
    frameCount,
    sample_rate
  );
  
  // Deinterleave samples into separate channels
  for (let ch = 0; ch < channels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = samples[i * channels + ch];
    }
  }
  
  return audioBuffer;
}

// Get flo file info (returns object with sample_rate, channels, bit_depth, etc.)
export async function getFloInfo(floData: ArrayBuffer): Promise<{
  sample_rate: number;
  channels: number;
  bit_depth: number;
  duration_secs: number;
  is_lossy: boolean;
  compression_ratio?: number;
}> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.info(uint8Flo);
}

// Validate flo file integrity (CRC32)
export async function validateFlo(floData: ArrayBuffer): Promise<boolean> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.validate(uint8Flo);
}

// Extract metadata as JS object (returns null if no metadata)
export async function getFloMetadata(
  floData: ArrayBuffer,
): Promise<{
  title?: string;
  artist?: string;
  album?: string;
  [key: string]: any;
} | null> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.get_metadata(uint8Flo);
}

// Extract cover art (returns { mime_type, data } or null)
export async function getFloCoverArt(
  floData: ArrayBuffer,
): Promise<{ mime_type: string; data: Uint8Array } | null> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.get_cover_art(uint8Flo);
}

// Extract synchronized lyrics (returns array of { timestamp_ms, text } or null)
export async function getFloSyncedLyrics(
  floData: ArrayBuffer,
): Promise<Array<{ timestamp_ms: number; text: string }> | null> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.get_synced_lyrics(uint8Flo);
}

// Create flo metadata from JS object (returns Uint8Array)
export async function createFloMetadataFromObject(
  obj: any,
): Promise<Uint8Array> {
  await ensureFloInitialized();
  return flo.create_metadata_from_object(obj);
}

// Export initialization function
export { initFlo, ensureFloInitialized };