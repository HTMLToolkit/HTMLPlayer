import { VisualizerType } from "../helpers/visualizerLoader";

const neuroSpectrogram: VisualizerType = {
  name: "Neural Network Spectrogram",
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
      nodeColor = "hsla({hue}, 80%, 50%, {alpha})",
      lineColor = "hsla({hue}, 70%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      nodesPerLayer = 8,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const layers = 3;
    const nodeSpacing = canvas.width / (layers + 1);
    const verticalSpacing = canvas.height / (nodesPerLayer + 1);

    const nodes = [];

    for (let layer = 0; layer < layers; layer++) {
      for (let node = 0; node < nodesPerLayer; node++) {
        const freqIndex = (layer * nodesPerLayer + node) % bufferLength;
        const amplitude = freqDataArray[freqIndex] / 256.0;

        nodes.push({
          x: nodeSpacing * (layer + 1),
          y: verticalSpacing * (node + 1),
          amplitude: amplitude,
        });
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const node1 = nodes[i];
      const layer1 = Math.floor(i / nodesPerLayer);

      if (layer1 < layers - 1) {
        for (let j = 0; j < nodesPerLayer; j++) {
          const nextIndex = (layer1 + 1) * nodesPerLayer + j;
          const node2 = nodes[nextIndex];

          const strength = (node1.amplitude + node2.amplitude) / 2;

          ctx.beginPath();
          ctx.moveTo(node1.x, node1.y);
          ctx.lineTo(node2.x, node2.y);
          ctx.strokeStyle = lineColor
            .replace("{hue}", `${(i * 360) / nodes.length}`)
            .replace("{alpha}", `${0.1 + strength * 0.3}`);
          ctx.lineWidth = strength * 2;
          ctx.stroke();
        }
      }

      ctx.fillStyle = nodeColor
        .replace("{hue}", `${(i * 360) / nodes.length}`)
        .replace("{alpha}", `${0.3 + node1.amplitude * 0.7}`);
      ctx.beginPath();
      ctx.arc(node1.x, node1.y, 3 + node1.amplitude * 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default neuroSpectrogram;
