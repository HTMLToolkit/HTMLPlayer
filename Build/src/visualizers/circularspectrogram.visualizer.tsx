import { VisualizerType } from "../helpers/visualizerLoader";

const circularSpectrogram: VisualizerType = {
  name: "Circular Spectrogram",
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
      baseColor = "hsl({hue}, 100%, 50%)",
      backgroundColor = "rgb(20, 20, 20)",
      pointSize = 3,
      radiusScale = 1.0,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * radiusScale - 10;

    for (let i = 0; i < bufferLength; i++) {
      const angle = (i * 2 * Math.PI) / bufferLength;
      const amplitude = freqDataArray[i] / 256.0;
      const x = centerX + radius * amplitude * Math.cos(angle);
      const y = centerY + radius * amplitude * Math.sin(angle);

      ctx.fillStyle = baseColor.replace("{hue}", `${(i * 360) / bufferLength}`);
      ctx.beginPath();
      ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default circularSpectrogram;
