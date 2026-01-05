import initReflo, * as reflo from "@flo-audio/reflo/reflo.js";

let refloInitialized = false;

async function ensureRefloInitialized() {
  if (!refloInitialized) {
    await initReflo(); // Initialize WASM module
    refloInitialized = true;
  }
}

/**
 * Decode a .flo file to WAV format using @flo-audio/reflo
 * This is used for Safari which needs standard formats for background playback
 * 
 * @param floData - ArrayBuffer containing flo audio data
 * @returns Uint8Array containing complete WAV file (headers + audio data)
 */
export async function decodeFloToWav(
  floData: ArrayBuffer,
): Promise<Uint8Array> {
  await ensureRefloInitialized();
  
  const uint8Flo = new Uint8Array(floData);
  
  // reflo.decode_flo_to_wav returns a complete WAV file
  const wavData = reflo.decode_flo_to_wav(uint8Flo);
  
  return wavData;
}

export { initReflo, ensureRefloInitialized };