import { VisualizerType } from "../helpers/visualizerLoader";

const frequencyStars: VisualizerType = {
  name: "Frequency Stars",
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
      starColor = "hsl({hue}, 100%, 80%)",
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      starSize = 4,
      threshold = 128,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < bufferLength; i++) {
      const value = freqDataArray[i];
      if (value > threshold) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = ((value - threshold) / 32) * starSize;

        ctx.fillStyle = starColor.replace(
          "{hue}",
          `${(i * 360) / bufferLength}`
        );
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const angle = (j * 4 * Math.PI) / 5;
          const px = x + size * Math.cos(angle);
          const py = y + size * Math.sin(angle);
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  },
};

export default frequencyStars;
