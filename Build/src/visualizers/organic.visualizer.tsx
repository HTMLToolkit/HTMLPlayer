import { VisualizerType } from "../helpers/visualizerLoader";

const organicSpectrogram: VisualizerType = {
  name: "Organic Growth Spectrogram",
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
      pointColor = "hsla({hue}, 80%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      pointSize = 5,
      growthAngle = 137.5,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < bufferLength; i++) {
      const angle = (i * growthAngle * Math.PI) / 180;
      const amplitude = freqDataArray[i] / 256.0;
      const radius = (amplitude * i) / 2;

      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.fillStyle = pointColor
        .replace("{hue}", `${(i * 360) / bufferLength}`)
        .replace("{alpha}", `${amplitude}`);
      ctx.beginPath();
      ctx.arc(x, y, amplitude * pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default organicSpectrogram;
