import {
  getByteFrequencyData,
  sample,
  VisualizerType,
} from "../../../platform/visualizers";

interface NeuralSpectrogramSettings {
  lineColor?: string;
  backgroundColor?: string;
  connectionDistance?: number;
}

const neuralSpectrogram: VisualizerType<NeuralSpectrogramSettings> = {
  name: "Neural Network Visualization",
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
      lineColor = "rgba(0, 255, 255, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      connectionDistance = 100,
    } = settings;

    if (dataType !== "frequency") return;
    getByteFrequencyData(analyser, freqDataArray);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const nodes = [];
    const connections = Math.floor(bufferLength / 4);

    for (let i = 0; i < connections; i++) {
      const x = (canvas.width / connections) * i;
      const y = canvas.height / 2 + (sample(freqDataArray, i) - 128) * 1.5;
      nodes.push({ x, y });

      for (let j = 0; j < nodes.length; j++) {
        const node = nodes[j];
        if (!node) continue;
        const distance = Math.hypot(node.x - x, node.y - y);
        if (distance < connectionDistance) {
          const opacity = 1 - distance / connectionDistance;
          ctx.strokeStyle = lineColor.replace("{alpha}", `${opacity}`);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(node.x, node.y);
          ctx.stroke();
        }
      }
    }
  },
};

export default neuralSpectrogram;
