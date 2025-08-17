import { VisualizerType } from "../helpers/visualizerLoader";

const architecturalBlueprint: VisualizerType = {
  name: "Architectural Blueprint",
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
      lineColor = "rgba(0, 149, 255, {alpha})",
      fillColor = "rgba(0, 149, 255, {alpha})",
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      margin = 50,
      amplitudeThreshold = 0.5,
      fontSize = 8,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = (canvas.width - margin * 2) / Math.sqrt(bufferLength);

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = freqDataArray[i] / 256.0;
      const col = i % Math.floor(Math.sqrt(bufferLength));
      const row = Math.floor(i / Math.floor(Math.sqrt(bufferLength)));

      const x = margin + col * gridSize;
      const y = margin + row * gridSize;

      ctx.strokeStyle = lineColor.replace("{alpha}", "0.5");
      ctx.beginPath();
      ctx.rect(x, y, gridSize * amplitude, gridSize * amplitude);
      ctx.stroke();

      if (amplitude > amplitudeThreshold) {
        ctx.fillStyle = fillColor.replace("{alpha}", "0.1");
        ctx.beginPath();
        ctx.arc(
          x + gridSize / 2,
          y + gridSize / 2,
          (gridSize / 4) * amplitude,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = lineColor.replace("{alpha}", "0.5");
        ctx.beginPath();
        ctx.moveTo(x, y + gridSize + 5);
        ctx.lineTo(x + gridSize * amplitude, y + gridSize + 5);
        ctx.stroke();

        ctx.fillStyle = lineColor.replace("{alpha}", "1.0");
        ctx.font = `${fontSize}px Arial`;
        ctx.fillText(`${Math.round(amplitude * 100)}%`, x, y + gridSize + 15);
      }
    }
  },
};

export default architecturalBlueprint;