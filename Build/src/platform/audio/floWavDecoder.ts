import initReflo, * as reflo from "@flo-audio/reflo/reflo.js";

let refloInitialized = false;

async function ensureInitialized() {
  if (!refloInitialized) {
    await initReflo();
    refloInitialized = true;
  }
}

export async function decodeFloToWav(
  floData: ArrayBuffer,
): Promise<Uint8Array> {
  await ensureInitialized();
  const uint8Flo = new Uint8Array(floData);
  return reflo.decode_flo_to_wav(uint8Flo);
}

export { initReflo, ensureInitialized };
