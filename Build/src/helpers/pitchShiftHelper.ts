export interface PitchShiftProcessor {
  setPitch: (semitones: number) => void;
  getPitch: () => number;
  getPassThroughNode: () => GainNode;
  connectToAudioElement: (element: HTMLAudioElement) => void;
  destroy: () => void;
}

/**
 * Create a pitch shifter using playbackRate (affects both pitch and tempo)
 * Pitch is measured in semitones: -100 to +100
 * 0 means no pitch shift
 *
 * NOTE: This implementation uses HTMLAudioElement.playbackRate which changes
 * both pitch and tempo together (like playing a record at different speeds).
 * For true pitch shifting without tempo change, complex DSP would be required.
 */
export function createPitchShifter(
  audioContext: AudioContext,
): PitchShiftProcessor {
  let currentPitch = 0;
  let isDestroyed = false;

  // Create a gain node to maintain the audio chain
  const passThroughGain = audioContext.createGain();
  passThroughGain.gain.value = 1.0;

  const processor: PitchShiftProcessor = {
    setPitch(semitones: number) {
      if (isDestroyed) return;

      // Clamp to -48 to +48 semitones (4 octaves, staying within browser playback rate limits)
      currentPitch = Math.max(-48, Math.min(48, semitones));
    },

    getPitch() {
      return currentPitch;
    },

    getPassThroughNode() {
      return passThroughGain;
    },

    connectToAudioElement(_element: HTMLAudioElement) {
      // No-op: pitch control is handled elsewhere
    },

    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;

      try {
        passThroughGain.disconnect();
      } catch (error) {
        console.error("Error destroying pitch shifter:", error);
      }
    },
  };

  return processor;
}

/**
 * Validate and clamp pitch value
 */
export function getValidPitch(pitch: number | undefined): number {
  if (typeof pitch !== "number" || !Number.isFinite(pitch)) {
    return 0; // Default to no pitch shift
  }
  // Clamp to -48 to +48 semitones (4 octaves, staying within browser playback rate limits)
  return Math.max(-48, Math.min(48, pitch));
}

/**
 * Convert semitones to a human-readable string
 */
export function formatPitchValue(semitones: number): string {
  if (semitones === 0) return "0";
  const sign = semitones > 0 ? "+" : "";
  return `${sign}${semitones}`;
}
