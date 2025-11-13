import { VisualizerType } from "../helpers/visualizerLoader";

const fractalSpectrogram: VisualizerType = {
  name: "Fractal Tree",
  dataType: "frequency",
  draw: function (
    analyser,
    canvas,
    ctx,
    _bufferLength,
    freqDataArray,
    dataType,
    settings = {},
  ) {
    const {
      branchColor = "hsla({hue}, 70%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      branchDepth = 9,
      branchLength = 100,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawBranch = (
      startX: number,
      startY: number,
      len: number,
      angle: number,
      depth: number,
      amplitude: number,
    ) => {
      if (depth === 0) return;

      const endX = startX + len * Math.cos(angle);
      const endY = startY - len * Math.sin(angle);

      ctx.strokeStyle = branchColor
        .replace("{hue}", `${depth * 30}`)
        .replace("{alpha}", `${amplitude}`);
      ctx.lineWidth = depth;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      drawBranch(
        endX,
        endY,
        len * 0.7,
        angle + amplitude,
        depth - 1,
        amplitude,
      );
      drawBranch(
        endX,
        endY,
        len * 0.7,
        angle - amplitude,
        depth - 1,
        amplitude,
      );
    };

    const baseAmplitude = freqDataArray[0] / 256.0;
    drawBranch(
      canvas.width / 2,
      canvas.height,
      branchLength,
      Math.PI / 2,
      branchDepth,
      baseAmplitude,
    );
  },
};

export default fractalSpectrogram;
