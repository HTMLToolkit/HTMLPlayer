import { sample, VisualizerType } from "../../../platform/visualizers";

interface WeatherSpectrogramSettings {
  cloudColor?: string;
  backgroundColor?: string;
  cloudHeight?: number;
  curveScale?: number;
}

const weatherSpectrogram: VisualizerType<WeatherSpectrogramSettings> = {
  name: "Weather Pattern Spectrogram",
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
      cloudColor = "rgba(255, 255, 255, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      cloudHeight = 0.33,
      curveScale = 100,
    } = settings;

    if (dataType !== "frequency") return;
    if (!(freqDataArray instanceof Uint8Array)) return;
    analyser.getByteFrequencyData(freqDataArray as Uint8Array<ArrayBuffer>);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const height = canvas.height * cloudHeight;
    for (let i = 0; i < bufferLength; i++) {
      const x = (i * canvas.width) / bufferLength;
      const amplitude = sample(freqDataArray, i) / 256.0;

      ctx.fillStyle = cloudColor.replace("{alpha}", `${amplitude}`);
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.quadraticCurveTo(
        x + 10,
        height - amplitude * curveScale,
        x + 20,
        height,
      );
      ctx.fill();
    }
  },
};

export default weatherSpectrogram;
