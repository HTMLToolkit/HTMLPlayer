import { VisualizerType } from "../helpers/visualizerLoader";

const matrixRain: VisualizerType = {
  name: "Matrix Rain",
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
      lineColor = "#0f0",
      textColor = "#0f0",
      backgroundColor = "rgba(0, 20, 0, 0.1)",
      lineWidth = 2,
      textInterval = 20,
      fontSize = 12,
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

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
        if (i % textInterval === 0) {
          ctx.fillStyle = textColor;
          ctx.font = `${fontSize}px monospace`;
          ctx.fillText(String.fromCharCode(33 + Math.random() * 93), x, y);
        }
      }
      x += sliceWidth;
    }

    ctx.stroke();
  },
};

export default matrixRain;
