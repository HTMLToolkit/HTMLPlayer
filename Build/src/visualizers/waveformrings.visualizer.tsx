import { VisualizerType } from "../helpers/visualizerLoader";

const waveformRings: VisualizerType = {
  name: "Waveform Rings",
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
      ringColor = "hsla({hue}, 70%, 50%, 0.5)",
      backgroundColor = "rgb(20, 20, 20)",
      ringCount = 5,
      lineWidth = 2,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const rings = ringCount;

    for (let ring = 0; ring < rings; ring++) {
      const baseRadius = (ring + 1) * (Math.min(centerX, centerY) / rings);

      ctx.beginPath();
      for (let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * 2 * Math.PI) / bufferLength;
        const radius = baseRadius + amplitude * 20;

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = ringColor.replace("{hue}", `${(ring * 360) / rings}`);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  },
};

export default waveformRings;
