import { VisualizerType } from "../helpers/visualizerLoader";

const pulsingOrbs: VisualizerType = {
  name: "Pulsing Orbs",
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
      orbColor = "hsl({hue}, 80%, 50%)",
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      orbCount = 12,
      maxRadius = 0.5,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const spacing = canvas.width / orbCount;

    for (let i = 0; i < orbCount; i++) {
      const freqIndex = Math.floor((i * bufferLength) / orbCount);
      const value = freqDataArray[freqIndex];
      const radius = (value / 256) * spacing * maxRadius;

      ctx.fillStyle = orbColor.replace("{hue}", `${(i * 360) / orbCount}`);
      ctx.beginPath();
      ctx.arc(spacing * (i + 0.5), canvas.height / 2, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default pulsingOrbs;
