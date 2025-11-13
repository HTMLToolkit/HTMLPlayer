import { VisualizerType } from "../helpers/visualizerLoader";

const fracturedCircle: VisualizerType = {
  name: "Fractured Circle",
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
      segmentColor = "hsl({hue}, 70%, 50%)",
      backgroundColor = "rgb(20, 20, 20)",
      segmentCount = 32,
      lineWidth = 3,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const segments = segmentCount;

    for (let i = 0; i < segments; i++) {
      const freqIndex = Math.floor((i / segments) * bufferLength);
      const amplitude = freqDataArray[freqIndex] / 256.0;
      const startAngle = (i * 2 * Math.PI) / segments;
      const endAngle = ((i + 1) * 2 * Math.PI) / segments;

      const radius = Math.min(centerX, centerY) * (0.5 + amplitude * 0.5);

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.strokeStyle = segmentColor.replace(
        "{hue}",
        `${(i * 360) / segments}`,
      );
      ctx.lineWidth = lineWidth + amplitude * 5;
      ctx.stroke();
    }
  },
};

export default fracturedCircle;
