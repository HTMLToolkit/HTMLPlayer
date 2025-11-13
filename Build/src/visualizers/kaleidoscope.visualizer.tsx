import { VisualizerType } from "../helpers/visualizerLoader";

const kaleidoscope: VisualizerType = {
  name: "Kaleidoscope",
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
      pointColor = "hsl({hue}, 100%, 50%)",
      backgroundColor = "rgba(0, 0, 0, 0.1)",
      segmentCount = 8,
      pointSize = 2,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const segments = segmentCount;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < bufferLength; i += 4) {
      const value = freqDataArray[i];
      const radius = (value / 256) * Math.min(centerX, centerY);

      for (let s = 0; s < segments; s++) {
        const angle =
          (s * 2 * Math.PI) / segments + (i * Math.PI) / bufferLength;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.fillStyle = pointColor.replace(
          "{hue}",
          `${(i * 360) / bufferLength}`,
        );
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },
};

export default kaleidoscope;
