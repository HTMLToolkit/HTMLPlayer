// Debouncing utility for IndexedDB saves

export const getValidTempo = (tempo: number | undefined) => {
  if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo <= 0) {
    return 1; // fallback to normal speed
  }
  return tempo;
};