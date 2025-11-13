import { VisualizerType } from "../helpers/visualizerLoader";

const oceanWaves: VisualizerType = {
  name: "Ocean Waves",
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
      lineColor = "rgba(0, 150, 255, 0.8)",
      backgroundColor = "rgba(0, 50, 100, 0.2)",
      lineWidth = 4,
      curveDepth = 10,
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
      else {
        ctx.quadraticCurveTo(x - sliceWidth / 2, y - curveDepth, x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
  },
};

export default oceanWaves;
