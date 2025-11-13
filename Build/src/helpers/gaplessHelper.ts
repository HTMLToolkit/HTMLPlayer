export interface GaplessOffsets {
  start: number;
  end: number;
}

export function calculateGaplessOffsets(song?: Song | null): GaplessOffsets {
  if (!song || !song.gapless || !song.encoding?.sampleRate) {
    return { start: 0, end: 0 };
  }

  const sampleRate = song.encoding.sampleRate;
  if (
    typeof sampleRate !== "number" ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0
  ) {
    return { start: 0, end: 0 };
  }

  const delaySamples = song.gapless.encoderDelay ?? 0;
  const paddingSamples = song.gapless.encoderPadding ?? 0;

  const startSeconds =
    typeof delaySamples === "number" &&
    Number.isFinite(delaySamples) &&
    delaySamples > 0
      ? delaySamples / sampleRate
      : 0;
  const endSeconds =
    typeof paddingSamples === "number" &&
    Number.isFinite(paddingSamples) &&
    paddingSamples > 0
      ? paddingSamples / sampleRate
      : 0;

  return {
    start: Number.isFinite(startSeconds) && startSeconds > 0 ? startSeconds : 0,
    end: Number.isFinite(endSeconds) && endSeconds > 0 ? endSeconds : 0,
  };
}
