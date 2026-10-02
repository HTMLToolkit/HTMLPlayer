export const clampVolume = (value: number): number =>
  Math.max(0, Math.min(1, value));

export const clampRate = (value: number): number =>
  Math.max(0.25, Math.min(4, value));

export const MAX_CROSSFADE_SECONDS = 10;

export const clampCrossfade = (value: number): number =>
  Math.max(0, Math.min(MAX_CROSSFADE_SECONDS, value));
