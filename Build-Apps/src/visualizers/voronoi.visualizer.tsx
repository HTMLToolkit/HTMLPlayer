import { VisualizerType, visualizerStates } from "../helpers/visualizerLoader";

const voronoiSpectrum: VisualizerType = {
  name: "Voronoi Spectrum",
  dataType: "frequency",
  draw: function (
    analyser,
    canvas,
    ctx,
    bufferLength,
    freqDataArray,
    dataType,
    settings = {}
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
      state = {
        points: new Array(pointCount).fill(null).map((_, i) => ({
          x: 0,
          y: 0,
          color: "",
          freqIndex: Math.floor((i * 1024) / pointCount),
        })),
        numPoints: pointCount,
        pixelSize: pixelSize,
        offscreen: document.createElement("canvas"),
        offscreenCtx: null as CanvasRenderingContext2D | null,
      };
      state.offscreen!.width = canvas.width;
      state.offscreen!.height = canvas.height;
      state.offscreenCtx = state.offscreen!.getContext("2d");
      visualizerStates.set("voronoiSpectrum", state);
    }

    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < state.numPoints!; i++) {
      const point = state.points![i];
      point.x = Math.random() * canvas.width;
      point.y = Math.random() * canvas.height;
      const value = freqDataArray[point.freqIndex] / 256;
      point.color = pointColor
        .replace("{hue}", `${(point.freqIndex * 360) / bufferLength}`)
        .replace("{lightness}", `${value * 100}`);
    }

    state.offscreenCtx!.clearRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < canvas.width; x += state.pixelSize!) {
      for (let y = 0; y < canvas.height; y += state.pixelSize!) {
        let minDist = Infinity;
        let closestColor = "";

        for (let p of state.points!) {
          const dx = x - p.x;
          const dy = y - p.y;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            closestColor = p.color;
          }
        }

        state.offscreenCtx!.fillStyle = closestColor;
        state.offscreenCtx!.fillRect(x, y, state.pixelSize!, state.pixelSize!);
      }
    }

    ctx.drawImage(state.offscreen!, 0, 0);
  },
};

export default voronoiSpectrum;
