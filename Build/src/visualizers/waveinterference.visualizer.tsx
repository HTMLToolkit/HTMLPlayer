import { VisualizerType } from "../helpers/visualizerLoader";

const interferenceSpectrogram: VisualizerType = {
  name: "Wave Interference Spectrogram",
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
      pointColor = "hsla({hue}, 70%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      pointSize = 2,
      waveSpacing = 20,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < bufferLength; i++) {
      const x = (i * canvas.width) / bufferLength;
      const amplitude = freqDataArray[i] / 256.0;

      for (let j = 0; j < canvas.height; j += waveSpacing) {
        const wave1 = Math.sin(x / 50 + amplitude * 10) * 10;
        const wave2 = Math.cos(x / 30) * 10;
        const interference = wave1 + wave2;

        ctx.fillStyle = pointColor
          .replace("{hue}", `${j + interference * 10}`)
          .replace("{alpha}", `${amplitude}`);
        ctx.beginPath();
        ctx.arc(x, j + interference, pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },
};

export default interferenceSpectrogram;
