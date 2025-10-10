import { VisualizerType } from "../helpers/visualizerLoader";

const neuralSpectrogram: VisualizerType = {
  name: "Neural Network Visualization",
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
      lineColor = "rgba(0, 255, 255, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      connectionDistance = 100,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const nodes = [];
    const connections = Math.floor(bufferLength / 4);

    for (let i = 0; i < connections; i++) {
      const x = (canvas.width / connections) * i;
      const y = canvas.height / 2 + (freqDataArray[i] - 128) * 1.5;
      nodes.push({ x, y });

      for (let j = 0; j < nodes.length; j++) {
        const distance = Math.hypot(nodes[j].x - x, nodes[j].y - y);
        if (distance < connectionDistance) {
          const opacity = 1 - distance / connectionDistance;
          ctx.strokeStyle = lineColor.replace("{alpha}", `${opacity}`);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
  },
};

export default neuralSpectrogram;
