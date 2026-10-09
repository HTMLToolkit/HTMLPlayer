import {
  getByteFrequencyData,
  sample,
  VisualizerType,
} from "../../../platform/visualizers";

interface FrequencyMeshSettings {
  lineColor?: string;
  backgroundColor?: string;
  pointCount?: number;
  lineWidth?: number;
}

const frequencyMesh: VisualizerType<FrequencyMeshSettings> = {
  name: "Frequency Mesh",
  dataType: "frequency",
  draw: function (
    analyser,
    canvas,
    ctx,
    bufferLength,
    freqDataArray,
    dataType,
    settings = {},
  ) {
    const {
      lineColor = "rgba(0, 255, 255, 0.5)",
      backgroundColor = "black",
      pointCount = 20,
      lineWidth = 1,
    } = settings;

    if (dataType !== "frequency") return;
    getByteFrequencyData(analyser, freqDataArray);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const points = [];
    const numPoints = pointCount;

    for (let i = 0; i < numPoints; i++) {
      const freqIndex = Math.floor((i * bufferLength) / numPoints);
      const value = sample(freqDataArray, freqIndex) / 256;
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
        const p1 = points[i];
        const p2 = points[j];
        if (!p1) continue;
        if (!p2) continue;
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
    }
    ctx.stroke();
  },
};

export default frequencyMesh;
