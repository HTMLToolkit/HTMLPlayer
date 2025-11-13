import { VisualizerType } from "../helpers/visualizerLoader";

const circularWave: VisualizerType = {
  name: "Circular Wave",
  dataType: "time",
  draw: function (
    analyser,
    canvas,
    ctx,
    bufferLength,
    timeDataArray,
    dataType,
    settings = {},
  ) {
    const {
      lineColor = "hsl({hue}, 100%, 50%)",
      backgroundColor = "rgba(0, 0, 0, 0.1)",
      lineWidth = 2,
      waveAmplitude = 50,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;

    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const angle = (i * 2 * Math.PI) / bufferLength;
      const value = (timeDataArray as Uint8Array)[i] / 128.0 - 1;
      const r = radius + value * waveAmplitude;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = lineColor.replace("{hue}", `${(Date.now() / 50) % 360}`);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  },
};

export default circularWave;
