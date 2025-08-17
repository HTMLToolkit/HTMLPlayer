import { VisualizerType } from "../helpers/visualizerLoader";

const frequencyMesh: VisualizerType = {
  name: "Frequency Mesh",
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
      lineColor = "rgba(0, 255, 255, 0.5)",
      backgroundColor = "black",
      pointCount = 20,
      lineWidth = 1,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const points = [];
    const numPoints = pointCount;

    for (let i = 0; i < numPoints; i++) {
      const freqIndex = Math.floor((i * bufferLength) / numPoints);
      const value = freqDataArray[freqIndex] / 256;
      points.push({
        x: (canvas.width * i) / (numPoints - 1),
        y: canvas.height / 2 + (value - 0.5) * canvas.height,
      });
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
      }
    }
    ctx.stroke();
  },
};

export default frequencyMesh;
