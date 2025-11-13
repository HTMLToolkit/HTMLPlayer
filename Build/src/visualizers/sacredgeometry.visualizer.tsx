import { VisualizerType } from "../helpers/visualizerLoader";

const sacredGeometrySpectrogram: VisualizerType = {
  name: "Sacred Geometry",
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
      lineColor = "hsla({hue}, 70%, 50%, {alpha})",
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      layerCount = 5,
      radiusScale = 0.8,
      amplitudeScale = 0.3,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) * radiusScale;

    for (let layer = 0; layer < layerCount; layer++) {
      const vertices = layer * 3 + 3;
      const radius = maxRadius * (1 - layer * 0.15);

      ctx.beginPath();
      for (let i = 0; i < vertices; i++) {
        const freqIndex = Math.floor((i * bufferLength) / vertices);
        const amplitude = freqDataArray[freqIndex] / 256.0;
        const angle = (i * Math.PI * 2) / vertices;

        const x =
          centerX +
          Math.cos(angle) * (radius * (1 + amplitude * amplitudeScale));
        const y =
          centerY +
          Math.sin(angle) * (radius * (1 + amplitude * amplitudeScale));

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = lineColor
        .replace("{hue}", `${layer * 72}`)
        .replace("{alpha}", `${0.5 + layer * 0.1}`);
      ctx.stroke();

      if (layer > 0) {
        for (let i = 0; i < vertices; i++) {
          const freqIndex = Math.floor((i * bufferLength) / vertices);
          const amplitude = freqDataArray[freqIndex] / 256.0;
          const angle = (i * Math.PI * 2) / vertices;

          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          const x =
            centerX +
            Math.cos(angle) * (radius * (1 + amplitude * amplitudeScale));
          const y =
            centerY +
            Math.sin(angle) * (radius * (1 + amplitude * amplitudeScale));
          ctx.lineTo(x, y);
          ctx.strokeStyle = lineColor
            .replace("{hue}", `${layer * 72}`)
            .replace("{alpha}", `${amplitude * 0.3}`);
          ctx.stroke();
        }
      }
    }
  },
};

export default sacredGeometrySpectrogram;
