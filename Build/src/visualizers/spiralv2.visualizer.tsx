import { VisualizerType } from "../helpers/visualizerLoader";

const spiralSpectrogramV2: VisualizerType = {
  name: "Spiral Spectrogram v2",
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
      pointColor = "hsl({hue}, {saturation}%, 50%)",
      backgroundColor = "rgb(20, 20, 20)",
      pointSize = 2,
      spiralTightness = 0.5,
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
      const angle = (i * 2 * Math.PI) / 64;
      const radius =
        (i / bufferLength) * maxRadius * spiralTightness + amplitude * 50;

      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.fillStyle = pointColor
        .replace("{hue}", `${(i * 360) / bufferLength}`)
        .replace("{saturation}", `${amplitude * 100}`);
      ctx.beginPath();
      ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default spiralSpectrogramV2;
