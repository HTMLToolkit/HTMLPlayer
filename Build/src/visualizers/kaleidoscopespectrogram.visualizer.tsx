import { VisualizerType } from "../helpers/visualizerLoader";

const kaleidoscopeSpectrogram: VisualizerType = {
  name: "Kaleidoscope Spectrogram",
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
      pointColor = "hsla({hue}, 85%, 50%, 0.5)",
      backgroundColor = "rgb(20, 20, 20)",
      mirrorCount = 8,
      pointSize = 3,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const mirrors = mirrorCount;

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = freqDataArray[i] / 256.0;
      const baseAngle = (i * 2 * Math.PI) / bufferLength;
      const radius = Math.min(centerX, centerY) * amplitude;

      for (let m = 0; m < mirrors; m++) {
        const angle = baseAngle + (m * 2 * Math.PI) / mirrors;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.fillStyle = pointColor.replace(
          "{hue}",
          `${(i * 360) / bufferLength}`
        );
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },
};

export default kaleidoscopeSpectrogram;
