const TIME_SMOOTHING_ALPHA = 0.4;

const timeSmoothingState = new WeakMap<HTMLCanvasElement, Float32Array>();

export function applyTimeDomainSmoothing(
  canvas: HTMLCanvasElement,
  dataArray: Uint8Array | Float32Array,
): void {
  const length = dataArray.length;
  let previous = timeSmoothingState.get(canvas);

  if (!previous || previous.length !== length) {
    previous = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      previous[i] = dataArray[i] ?? 0;
    }
    timeSmoothingState.set(canvas, previous);
    return;
  }

  for (let i = 0; i < length; i++) {
    const raw = dataArray[i] ?? 0;
    const smoothed =
      raw * TIME_SMOOTHING_ALPHA + previous[i]! * (1 - TIME_SMOOTHING_ALPHA);
    dataArray[i] = Math.round(smoothed);
    previous[i] = smoothed;
  }
}
