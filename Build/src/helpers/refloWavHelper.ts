import * as reflo from "@flo-audio/reflo/reflo.js";

let refloInitialized = false;
async function ensureRefloInitialized() {
  if (!refloInitialized) {
    await reflo.default(); // WASM init
    refloInitialized = true;
  }
}

// Decode a .flo file buffer to WAV (Uint8Array) using @flo-audio/reflo
export async function decodeFloToWav(
  floData: ArrayBuffer,
): Promise<Uint8Array> {
  await ensureRefloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return reflo.decode_flo_to_wav(uint8Flo);
}
