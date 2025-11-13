// Debouncing utility for IndexedDB saves

export const getValidTempo = (tempo: number | undefined) => {
  if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo <= 0) {
    return 1; // fallback to normal speed
  }
  return tempo;
};

/**
 * Calculate combined playback rate from tempo and pitch, clamped to browser limits (0.25-4.0)
 * Tempo and pitch are applied multiplicatively: rate = tempo × 2^(pitch/12)
 */
export const getValidPlaybackRate = (
  tempo: number | undefined,
  pitch: number | undefined,
): number => {
  const validTempo = getValidTempo(tempo);
  const validPitch = pitch ?? 0;

  // Convert pitch (semitones) to frequency multiplier
  const pitchMultiplier = Math.pow(2, validPitch / 12);

  // Combine tempo and pitch
  const combinedRate = validTempo * pitchMultiplier;

  // Clamp to browser's supported playback rate range
  return Math.max(0.25, Math.min(4.0, combinedRate));
};
