import { VisualizerType } from "../helpers/visualizerLoader";

const waveformTunnel: VisualizerType = {
  name: "Waveform Tunnel",
  dataType: "time",
  draw: function (
    analyser,
    canvas,
    ctx,
    bufferLength,
    timeDataArray,
    dataType,
    settings = {}
  ) {
    const {
      lineColor = "hsl({hue}, 100%, 50%)",
      backgroundColor = "rgba(0, 0, 0, 0.1)",
      lineWidth = 2,
      radiusStep = 10,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY);

    for (let radius = maxRadius; radius > 0; radius -= radiusStep) {
      ctx.beginPath();
      for (let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / bufferLength;
        const value = timeDataArray[i] / 128.0 - 1;
        const r = radius + value * 20;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = lineColor.replace(
        "{hue}",
        `${(radius * 360) / maxRadius}`
      );
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  },
};

export default waveformTunnel;
