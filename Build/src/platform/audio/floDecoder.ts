import initFlo, * as flo from "@flo-audio/libflo-audio";

let floInitialized = false;

async function ensureFloInitialized() {
  if (!floInitialized) {
    await initFlo();
    floInitialized = true;
  }
}

export async function decodeFloToAudioBuffer(
  floData: ArrayBuffer,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  await ensureFloInitialized();

  const uint8Flo = new Uint8Array(floData);
  const samples = flo.decode(uint8Flo);
  const fileInfo = flo.info(uint8Flo);
  const { channels, sample_rate } = fileInfo;
  const frameCount = samples.length / channels;

  const audioBuffer = audioContext.createBuffer(
    channels,
    frameCount,
    sample_rate,
  );

  for (let ch = 0; ch < channels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = samples[i * channels + ch];
    }
  }

  return audioBuffer;
}

export async function getFloInfo(floData: ArrayBuffer) {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.info(uint8Flo);
}

export async function validateFlo(floData: ArrayBuffer): Promise<boolean> {
  await ensureFloInitialized();
  const uint8Flo = new Uint8Array(floData);
  return flo.validate(uint8Flo);
}
