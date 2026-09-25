import {
  getByteFrequencyData,
  sample,
  VisualizerType,
} from "../../../platform/visualizers";

interface FlowerSpectrogramSettings {
  pointColor?: string;
  backgroundColor?: string;
  pointSize?: number;
  petalCount?: number;
}

const flowerSpectrogram: VisualizerType<FlowerSpectrogramSettings> = {
  name: "Flower Spectrogram",
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
      pointColor = "hsla({hue}, 80%, 50%, 0.6)",
      backgroundColor = "rgb(20, 20, 20)",
      pointSize = 3,
      petalCount = 12,
    } = settings;

    if (dataType !== "frequency") return;
    getByteFrequencyData(analyser, freqDataArray);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = sample(freqDataArray, i) / 256.0;
      const angle = (i * 2 * Math.PI) / bufferLength;
      const radius = Math.min(centerX, centerY) * amplitude;

      const petalAngle = angle * petalCount;
      const x = centerX + radius * Math.cos(petalAngle);
      const y = centerY + radius * Math.sin(petalAngle);

      ctx.fillStyle = pointColor.replace(
        "{hue}",
        `${(i * 360) / bufferLength}`,
      );
      ctx.beginPath();
      ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default flowerSpectrogram;
