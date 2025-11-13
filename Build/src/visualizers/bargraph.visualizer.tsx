import { VisualizerType } from "../helpers/visualizerLoader";

const barGraph: VisualizerType = {
  name: "Bar Graph",
  dataType: "frequency",
  draw: function (
    analyser,
    canvas,
    ctx,
    bufferLength,
    dataArray,
    dataType,
    settings = {},
  ) {
    const {
      barColor = "hsl({hue}, 80%, 50%)",
      backgroundColor = "rgb(20, 20, 20)",
      barSpacing = 1,
      shadowBlur = 5,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(dataArray as any);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width / bufferLength - barSpacing;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillStyle = barColor.replace("{hue}", `${(i * 360) / bufferLength}`);
      ctx.shadowBlur = shadowBlur;
      ctx.shadowColor = ctx.fillStyle as string;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + barSpacing;
    }
    ctx.shadowBlur = 0;
  },
};

export default barGraph;
