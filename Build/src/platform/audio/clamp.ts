export const clampVolume = (value: number): number =>
  Math.max(0, Math.min(1, value));

export const clampRate = (value: number): number =>
  Math.max(0.25, Math.min(4, value));
