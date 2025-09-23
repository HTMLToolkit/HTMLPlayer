// Debouncing utility for IndexedDB saves
export const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: number;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
};

export const getValidTempo = (tempo: number | undefined) => {
  if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo <= 0) {
    return 1; // fallback to normal speed
  }
  return tempo;
};