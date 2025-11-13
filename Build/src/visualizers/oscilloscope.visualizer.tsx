import { VisualizerType } from "../helpers/visualizerLoader";

const oscilloscope: VisualizerType = {
  name: "Oscilloscope",
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
      lineColor = "rgb(0, 255, 0)",
      backgroundColor = "rgb(20, 20, 20)",
      lineWidth = 3,
      glowIntensity = 0.5,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;
    ctx.shadowBlur = 10 * glowIntensity;
    ctx.shadowColor = lineColor;
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

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  },
};

export default oscilloscope;
