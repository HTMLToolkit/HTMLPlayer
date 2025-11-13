import { VisualizerType } from "../helpers/visualizerLoader";

const cosmicPulse: VisualizerType = {
  name: "Cosmic Pulse",
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
      pointColor = "hsla({hue}, 80%, 50%, {alpha})",
      lineColor = "hsla({hue}, 80%, 50%, 0.2)",
      backgroundColor = "rgba(0, 0, 20, 0.2)",
      pointInterval = 8,
      pointSize = 5,
      radiusScale = 1.0,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < bufferLength; i += pointInterval) {
      const v = timeDataArray[i] / 128.0;
      const radius = v * Math.min(centerX, centerY) * radiusScale;
      const angle = (i * 2 * Math.PI) / bufferLength;

      ctx.beginPath();
      ctx.fillStyle = pointColor
        .replace("{hue}", `${(i / bufferLength) * 360}`)
        .replace("{alpha}", `${v * 0.5}`);

      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle + 0.2) * (radius * 0.8);
      const y2 = centerY + Math.sin(angle + 0.2) * (radius * 0.8);

      ctx.arc(x1, y1, v * pointSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = lineColor.replace(
        "{hue}",
        `${(i / bufferLength) * 360}`,
      );
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  },
};

export default cosmicPulse;
