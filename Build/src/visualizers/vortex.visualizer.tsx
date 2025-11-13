import { VisualizerType } from "../helpers/visualizerLoader";

const vortexSpectrogram: VisualizerType = {
  name: "Vortex Spectrogram",
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
      pointColor = "hsla({hue}, 90%, {lightness}%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      pointSize = 2,
      vortexScale = 0.5,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY);

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = freqDataArray[i] / 256.0;
      const angle = (i * 8 * Math.PI) / bufferLength;
      const radius =
        (i / bufferLength) * maxRadius * (1 + amplitude * vortexScale);

      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.fillStyle = pointColor
        .replace("{hue}", `${(i * 360) / bufferLength}`)
        .replace("{lightness}", `${40 + amplitude * 60}`)
        .replace("{alpha}", `${0.1 + amplitude * 0.6}`);
      ctx.beginPath();
      ctx.arc(x, y, pointSize + amplitude * 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default vortexSpectrogram;
