import { VisualizerType } from "../helpers/visualizerLoader";

const fluidWaveSpectrogram: VisualizerType = {
  name: "Fluid Wave",
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
      waveColor = "hsla({hue}, 70%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      layerCount = 4,
      lineWidth = 3,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const layers = layerCount;

    for (let l = 0; l < layers; l++) {
      ctx.beginPath();
      const layerOffset = (l * canvas.height) / layers;

      for (let i = 0; i <= bufferLength; i++) {
        const x = (i / bufferLength) * canvas.width;
        const freqIndex = i % bufferLength;
        const amplitude = freqDataArray[freqIndex] / 256.0;

        const wave1 = Math.sin(i * 0.1 + l * 0.5) * 30 * amplitude;
        const wave2 = Math.cos(i * 0.05 + l * 0.3) * 20 * amplitude;
        const y = layerOffset + wave1 + wave2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      const gradient = ctx.createLinearGradient(
        0,
        layerOffset - 50,
        0,
        layerOffset + 50,
      );
      gradient.addColorStop(
        0,
        waveColor.replace("{hue}", `${l * 90}`).replace("{alpha}", "0"),
      );
      gradient.addColorStop(
        0.5,
        waveColor.replace("{hue}", `${l * 90}`).replace("{alpha}", "0.3"),
      );
      gradient.addColorStop(
        1,
        waveColor.replace("{hue}", `${l * 90}`).replace("{alpha}", "0"),
      );

      ctx.strokeStyle = gradient;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  },
};

export default fluidWaveSpectrogram;
