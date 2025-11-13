import { VisualizerType } from "../helpers/visualizerLoader";

const tessellationSpectrogram: VisualizerType = {
  name: "Tessellation Spectrogram",
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
      tileColor = "hsla({hue}, 70%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      tileSize = 30,
      tileShape = "hexagon",
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < bufferLength; i++) {
      const x = (i % (canvas.width / tileSize)) * tileSize;
      const y = Math.floor(i / (canvas.width / tileSize)) * tileSize;
      const amplitude = freqDataArray[i] / 256.0;

      ctx.fillStyle = tileColor
        .replace("{hue}", `${amplitude * 360}`)
        .replace("{alpha}", `${amplitude}`);
      ctx.beginPath();
      if (tileShape === "hexagon") {
        for (let j = 0; j < 6; j++) {
          const angle = (j * Math.PI) / 3;
          const px = x + tileSize * Math.cos(angle);
          const py = y + tileSize * Math.sin(angle);
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
      } else {
        ctx.rect(x, y, tileSize, tileSize);
      }
      ctx.closePath();
      ctx.fill();
    }
  },
};

export default tessellationSpectrogram;
