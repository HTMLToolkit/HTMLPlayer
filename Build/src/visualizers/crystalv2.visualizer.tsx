import { VisualizerType } from "../helpers/visualizerLoader";

const crystalSpectrogramV2: VisualizerType = {
  name: "Crystalline Formation",
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
      lineColor = "hsla({hue}, 90%, 70%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      lineCount = 5,
      radiusScale = 200,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = freqDataArray[i] / 256.0;
      const angle = (i * 72 * Math.PI) / 180;

      for (let j = 0; j < lineCount; j++) {
        const radius = amplitude * radiusScale + j * 30;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.strokeStyle = lineColor
          .replace("{hue}", `${(i * 360) / bufferLength}`)
          .replace("{alpha}", `${amplitude}`);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  },
};

export default crystalSpectrogramV2;
