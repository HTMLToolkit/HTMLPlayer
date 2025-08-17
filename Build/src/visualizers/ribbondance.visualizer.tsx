import { VisualizerType } from "../helpers/visualizerLoader";

const ribbonDance: VisualizerType = {
  name: "Ribbon Dance",
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
      ribbonColor = "hsla({hue}, 70%, 50%, 0.6)",
      backgroundColor = "rgb(20, 20, 20)",
      ribbonCount = 3,
      lineWidth = 3,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const ribbons = ribbonCount;
    const points = bufferLength / ribbons;

    for (let r = 0; r < ribbons; r++) {
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const freqIndex = Math.floor(i + r * points);
        const amplitude = freqDataArray[freqIndex] / 256.0;

        const x = (i / points) * canvas.width;
        const y =
          canvas.height / 2 + Math.sin(i * 0.1 + r * 2) * 100 * amplitude;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = ribbonColor.replace("{hue}", `${r * 120}`);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  },
};

export default ribbonDance;
