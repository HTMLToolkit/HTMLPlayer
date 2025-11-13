import { VisualizerType } from "../helpers/visualizerLoader";

const neonWave: VisualizerType = {
  name: "Neon Wave",
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
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      lineWidth = 3,
      glowIntensity = 0.5,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor.replace("{hue}", `${Date.now() % 360}`);
    ctx.shadowBlur = 10 * glowIntensity;
    ctx.shadowColor = ctx.strokeStyle as string;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeDataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  },
};

export default neonWave;
