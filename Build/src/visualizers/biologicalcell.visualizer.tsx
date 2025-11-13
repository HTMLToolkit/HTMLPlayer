import { VisualizerType } from "../helpers/visualizerLoader";

const biologicalCell: VisualizerType = {
  name: "Biological Cell",
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
      membraneColor = "rgba(255, 255, 255, {alpha})",
      organelleColor = "hsla({hue}, 70%, 50%, {alpha})",
      connectionColor = "rgba(255, 255, 255, {alpha})",
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      cellRadiusScale = 0.8,
      organelleSize = 20,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const cellRadius = Math.min(centerX, centerY) * cellRadiusScale;

    ctx.strokeStyle = membraneColor.replace("{alpha}", "0.2");
    ctx.beginPath();
    ctx.arc(centerX, centerY, cellRadius, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = freqDataArray[i] / 256.0;
      const angle = (i * Math.PI * 2) / bufferLength;
      const radius = cellRadius * (0.2 + amplitude * 0.6);

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.fillStyle = organelleColor
        .replace("{hue}", `${(i * 360) / bufferLength}`)
        .replace("{alpha}", `${amplitude}`);
      ctx.beginPath();
      ctx.arc(x, y, amplitude * organelleSize, 0, Math.PI * 2);
      ctx.fill();

      if (i > 0) {
        ctx.strokeStyle = connectionColor.replace(
          "{alpha}",
          `${amplitude * 0.3}`,
        );
        ctx.beginPath();
        ctx.moveTo(x, y);
        const prevAngle = ((i - 1) * Math.PI * 2) / bufferLength;
        const prevX = centerX + Math.cos(prevAngle) * radius;
        const prevY = centerY + Math.sin(prevAngle) * radius;
        ctx.lineTo(prevX, prevY);
        ctx.stroke();
      }
    }
  },
};

export default biologicalCell;
