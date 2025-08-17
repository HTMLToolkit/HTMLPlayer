import { VisualizerType } from "../helpers/visualizerLoader";

const waveformSpectrum: VisualizerType = {
  name: "Waveform Spectrum",
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
      lineColor = "rgb(0, 255, 0)",
      backgroundColor = "rgb(20, 20, 20)",
      lineWidth = 2,
      glowIntensity = 0.5,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);

    for (let i = 0; i < bufferLength; i++) {
      const x = (i * canvas.width) / bufferLength;
      const y = (freqDataArray[i] / 256.0) * canvas.height;
      ctx.lineTo(x, y);
    }

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;
    ctx.shadowBlur = 10 * glowIntensity;
    ctx.shadowColor = lineColor;
    ctx.stroke();
    ctx.shadowBlur = 0;
  },
};

export default waveformSpectrum;
