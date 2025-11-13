import { VisualizerType } from "../helpers/visualizerLoader";

const dnaSpectrogramV2: VisualizerType = {
  name: "DNA Helix",
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
      lineColor = "hsla({hue}, 70%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      frequency = 0.02,
      amplitudeScale = 100,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < bufferLength; i++) {
      const t = i * 5;
      const wave1 = Math.sin(t * frequency) * amplitudeScale;
      const wave2 = Math.sin(t * frequency + Math.PI) * amplitudeScale;

      const x1 = t + canvas.width / 4;
      const y1 = canvas.height / 2 + wave1;
      const x2 = t + canvas.width / 4;
      const y2 = canvas.height / 2 + wave2;

      const intensity = freqDataArray[i] / 256.0;

      ctx.strokeStyle = lineColor
        .replace("{hue}", `${i}`)
        .replace("{alpha}", `${intensity}`);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  },
};

export default dnaSpectrogramV2;
