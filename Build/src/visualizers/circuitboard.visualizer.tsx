import { VisualizerType } from "../helpers/visualizerLoader";

const circuitBoard: VisualizerType = {
  name: "Circuit Board",
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
      circuitColor = "rgba(0, 255, 0, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      gridSize = 20,
      nodeSize = 3,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = freqDataArray[i] / 256.0;
      const x = (i % (canvas.width / gridSize)) * gridSize;
      const y = Math.floor(i / (canvas.width / gridSize)) * gridSize;

      ctx.strokeStyle = circuitColor.replace("{alpha}", `${amplitude}`);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);

      if (amplitude > 0.5) {
        ctx.lineTo(x + gridSize, y);
        ctx.lineTo(x + gridSize, y + gridSize);
      } else {
        ctx.lineTo(x, y + gridSize);
        ctx.lineTo(x + gridSize, y + gridSize);
      }

      ctx.stroke();

      ctx.fillStyle = circuitColor.replace("{alpha}", `${amplitude}`);
      ctx.beginPath();
      ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

export default circuitBoard;
