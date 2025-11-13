import { VisualizerType } from "../helpers/visualizerLoader";

const quantumSpectrogram: VisualizerType = {
  name: "Quantum Field",
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
      pointColor = "hsla({hue}, 90%, 50%, {alpha})",
      lineColor = "rgba(255, 255, 255, {alpha})",
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      fieldSize = 20,
      probabilityThreshold = 0.5,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cols = Math.floor(canvas.width / fieldSize);
    const rows = Math.floor(canvas.height / fieldSize);

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const freqIndex = Math.floor((i + j) % bufferLength);
        const amplitude = freqDataArray[freqIndex] / 256.0;
        const probability = Math.random() * amplitude;

        if (probability > probabilityThreshold) {
          const x = i * fieldSize + fieldSize / 2;
          const y = j * fieldSize + fieldSize / 2;

          ctx.fillStyle = pointColor
            .replace("{hue}", `${(freqIndex * 360) / bufferLength}`)
            .replace("{alpha}", `${amplitude}`);
          ctx.beginPath();
          ctx.arc(x, y, amplitude * fieldSize * 0.5, 0, Math.PI * 2);
          ctx.fill();

          if (i > 0 && j > 0) {
            ctx.strokeStyle = lineColor.replace(
              "{alpha}",
              `${amplitude * 0.2}`,
            );
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - fieldSize, y - fieldSize);
            ctx.stroke();
          }
        }
      }
    }
  },
};

export default quantumSpectrogram;
