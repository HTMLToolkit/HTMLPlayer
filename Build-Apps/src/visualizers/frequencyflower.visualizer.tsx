import { VisualizerType } from "../helpers/visualizerLoader";

const frequencyFlower: VisualizerType = {
  name: "Frequency Flower",
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
      lineColor = "hsl({hue}, 100%, 50%)",
      backgroundColor = "rgba(0, 0, 0, 0.1)",
      lineWidth = 2,
      petalCount = 8,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = Math.min(centerX, centerY) * 0.3;

    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const angle = (i * 2 * Math.PI) / bufferLength;
      const value = freqDataArray[i] / 256;
      const radius =
        baseRadius + value * baseRadius * Math.sin(petalCount * angle);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = lineColor.replace("{hue}", `${(Date.now() / 30) % 360}`);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  },
};

export default frequencyFlower;
