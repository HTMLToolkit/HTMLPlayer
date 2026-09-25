import {
  getByteFrequencyData,
  sample,
  visualizerStates,
  VisualizerType,
} from "../../../platform/visualizers";

interface VoronoiSpectrumSettings {
  pointCount?: number;
  pixelSize?: number;
  backgroundColor?: string;
  pointColor?: string;
}

const voronoiSpectrum: VisualizerType<VoronoiSpectrumSettings> = {
  name: "Voronoi Spectrum",
  dataType: "frequency",
  draw: function (
    analyser,
    canvas,
    ctx,
    bufferLength,
    freqDataArray,
    dataType,
    settings = {},
  ) {
    const {
      pointCount = 20,
      pixelSize = 4,
      backgroundColor = "rgba(0, 0, 0, 0.1)",
      pointColor = "hsl({hue}, 100%, {lightness}%)",
    } = settings;

    if (dataType !== "frequency") return;
    let state = visualizerStates.get("voronoiSpectrum") || {};
    if (!state.points) {
      const offscreen = document.createElement("canvas");
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offscreenCtx = offscreen.getContext("2d");
      if (!offscreenCtx) return;
      state = {
        points: new Array(pointCount).fill(null).map((_, i) => ({
          x: 0,
          y: 0,
          color: "",
          freqIndex: Math.floor((i * 1024) / pointCount),
        })),
        numPoints: pointCount,
        pixelSize: pixelSize,
        offscreen,
        offscreenCtx,
      };
      visualizerStates.set("voronoiSpectrum", state);
    }

    getByteFrequencyData(analyser, freqDataArray);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const points = state.points;
    const numPoints = state.numPoints ?? pointCount;
    const pixel = state.pixelSize ?? pixelSize;
    const offscreenCtx = state.offscreenCtx;
    const offscreen = state.offscreen;
    if (!points || !offscreenCtx || !offscreen) return;

    for (let i = 0; i < numPoints; i++) {
      const point = points[i];
      if (!point) continue;
      point.x = Math.random() * canvas.width;
      point.y = Math.random() * canvas.height;
      const value = sample(freqDataArray, point.freqIndex) / 256;
      point.color = pointColor
        .replace("{hue}", `${(point.freqIndex * 360) / bufferLength}`)
        .replace("{lightness}", `${value * 100}`);
    }

    offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < canvas.width; x += pixel) {
      for (let y = 0; y < canvas.height; y += pixel) {
        let minDist = Infinity;
        let closestColor = "";

        for (let p of points) {
          const dx = x - p.x;
          const dy = y - p.y;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            closestColor = p.color;
          }
        }

        offscreenCtx.fillStyle = closestColor;
        offscreenCtx.fillRect(x, y, pixel, pixel);
      }
    }

    ctx.drawImage(offscreen, 0, 0);
  },
};

export default voronoiSpectrum;
