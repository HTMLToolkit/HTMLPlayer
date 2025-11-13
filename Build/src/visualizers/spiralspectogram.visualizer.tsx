import { VisualizerType } from "../helpers/visualizerLoader";

const spiralSpectrogram: VisualizerType = {
  name: "Spiral Spectrogram",
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
      pointColor = "hsl({hue}, 100%, 50%)",
      backgroundColor = "rgb(20, 20, 20)",
      pointSize = 5,
      spiralTightness = 0.1,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    let radius = 10;

    for (let i = 0; i < bufferLength; i++) {
      const angle = (i * 2 * Math.PI) / 64;
      const amplitude = freqDataArray[i] / 256.0;
      radius += spiralTightness;

      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.fillStyle = pointColor.replace("{hue}", `${freqDataArray[i]}`);
      ctx.beginPath();
      ctx.arc(x, y, amplitude * pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default spiralSpectrogram;
