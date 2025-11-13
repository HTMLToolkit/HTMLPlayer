import { VisualizerType } from "../helpers/visualizerLoader";

const particleField: VisualizerType = {
  name: "Particle Field",
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
      particleColor = "hsla({hue}, {saturation}%, {lightness}%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      particleCount = 100,
      baseRadius = 0.25,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const particles = particleCount;
    const radius = Math.min(canvas.width, canvas.height) * baseRadius;

    for (let i = 0; i < particles; i++) {
      const freqIndex = Math.floor((i / particles) * bufferLength);
      const amplitude = freqDataArray[freqIndex] / 256.0;
      const angle = (i * 2 * Math.PI) / particles;

      const particleRadius = radius + amplitude * 100;
      const x = canvas.width / 2 + particleRadius * Math.cos(angle);
      const y = canvas.height / 2 + particleRadius * Math.sin(angle);

      const size = 2 + amplitude * 5;

      ctx.fillStyle = particleColor
        .replace("{hue}", `${(freqIndex * 360) / bufferLength}`)
        .replace("{saturation}", `${80 + amplitude * 20}`)
        .replace("{lightness}", `${50 + amplitude * 50}`)
        .replace("{alpha}", `${0.3 + amplitude * 0.7}`);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default particleField;
