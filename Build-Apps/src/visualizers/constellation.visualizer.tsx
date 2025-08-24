import { VisualizerType } from "../helpers/visualizerLoader";

const constellationSpectrogram: VisualizerType = {
  name: "Constellation Spectrogram",
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
      pointColor = "hsla({hue}, 80%, 50%, {alpha})",
      lineColor = "hsla({hue}, 70%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      connectionCount = 3,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const points = [];
    const connections = connectionCount;

    for (let i = 0; i < bufferLength; i += 2) {
      const amplitude = freqDataArray[i] / 256.0;
      const angle = (i * 2 * Math.PI) / bufferLength;
      const radius =
        (Math.min(canvas.width, canvas.height) / 3) * (0.5 + amplitude * 0.5);

      points.push({
        x: canvas.width / 2 + radius * Math.cos(angle),
        y: canvas.height / 2 + radius * Math.sin(angle),
        amplitude: amplitude,
      });
    }

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];

      for (let j = 0; j < connections; j++) {
        const nextIndex = (i + j + 1) % points.length;
        const p2 = points[nextIndex];

        const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (distance < 100) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = lineColor
            .replace("{hue}", `${(i * 360) / points.length}`)
            .replace(
              "{alpha}",
              `${0.15 + (p1.amplitude + p2.amplitude) * 0.2}`
            );
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.fillStyle = pointColor
        .replace("{hue}", `${(i * 360) / points.length}`)
        .replace("{alpha}", `${0.3 + p1.amplitude * 0.7}`);
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 2 + p1.amplitude * 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default constellationSpectrogram;
