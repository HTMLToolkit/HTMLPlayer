import { VisualizerType } from "../helpers/visualizerLoader";

const nebulaSpectrogram: VisualizerType = {
  name: "Cosmic Nebula",
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
      nebulaColor = "hsla({hue}, 80%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      radiusScale = 200,
      pointSize = 50,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    //@ts-ignore
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = freqDataArray[i] / 256.0;
      const angle = (i * Math.PI * 2) / bufferLength;

      const x = canvas.width / 2 + Math.cos(angle) * (amplitude * radiusScale);
      const y = canvas.height / 2 + Math.sin(angle) * (amplitude * radiusScale);

      ctx.fillStyle = nebulaColor
        .replace("{hue}", `${270 + i}`)
        .replace("{alpha}", `${amplitude * 0.1}`);
      ctx.beginPath();
      ctx.arc(x, y, amplitude * pointSize, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

export default nebulaSpectrogram;
