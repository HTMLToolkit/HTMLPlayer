import { VisualizerType } from "../helpers/visualizerLoader";

const liquidMetal: VisualizerType = {
  name: "Liquid Metal",
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
      gradientColors = [
        { stop: 0, color: "#666" },
        { stop: 0.5, color: "#fff" },
        { stop: 1, color: "#888" },
      ],
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      lineWidth = 4,
      curveAmplitude = 20,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradientColors.forEach(({ stop, color }: any) =>
      gradient.addColorStop(stop, color),
    );

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = gradient;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeDataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else {
        const cp1x = x - sliceWidth / 2;
        const cp1y = y + Math.sin(Date.now() / 1000 + i / 20) * curveAmplitude;
        ctx.quadraticCurveTo(cp1x, cp1y, x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
  },
};

export default liquidMetal;
