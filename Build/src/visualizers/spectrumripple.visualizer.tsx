import { VisualizerType } from "../helpers/visualizerLoader";

const spectrumRipple: VisualizerType = {
  name: "Spectrum Ripple",
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
      rippleColor = "hsla({hue}, 100%, 50%, 0.5)",
      backgroundColor = "rgba(0, 0, 0, 0.1)",
      lineWidth = 2,
      rippleStep = 4,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < bufferLength; i += rippleStep) {
      const value = freqDataArray[i];
      const radius = (value / 256) * Math.min(centerX, centerY);

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = rippleColor.replace(
        "{hue}",
        `${(i * 360) / bufferLength}`,
      );
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  },
};

export default spectrumRipple;
