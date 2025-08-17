import { VisualizerType } from "../helpers/visualizerLoader";

const starField: VisualizerType = {
  name: "Star Field",
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
      lineColor = "rgba(255, 255, 255, 0.8)",
      starColor = "rgba(255, 255, 255, {alpha})",
      backgroundColor = "rgba(0, 0, 20, 0.3)",
      lineWidth = 2,
      starInterval = 15,
      starSize = 2,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeDataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      if (i % starInterval === 0) {
        ctx.fillStyle = starColor.replace("{alpha}", `${Math.random()}`);
        ctx.fillRect(x, Math.random() * canvas.height, starSize, starSize);
      }
      x += sliceWidth;
    }

    ctx.stroke();
  },
};

export default starField;
