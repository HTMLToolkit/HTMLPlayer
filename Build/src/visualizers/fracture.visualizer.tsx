import { VisualizerType } from "../helpers/visualizerLoader";

const fractureSpectrogram: VisualizerType = {
  name: "Fracture Spectrogram",
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
      segmentColor = "hsla({hue}, {saturation}%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      segmentCount = 16,
      layerCount = 4,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const segments = segmentCount;
    const layers = layerCount;

    for (let layer = 0; layer < layers; layer++) {
      const radius =
        ((layer + 1) * Math.min(canvas.width, canvas.height)) / (layers * 2);

      for (let i = 0; i < segments; i++) {
        const freqIndex = (layer * segments + i) % bufferLength;
        const amplitude = freqDataArray[freqIndex] / 256.0;

        const startAngle =
          (i * 2 * Math.PI) / segments + (layer * Math.PI) / (layers * 2);
        const endAngle =
          ((i + 1) * 2 * Math.PI) / segments + (layer * Math.PI) / (layers * 2);

        ctx.beginPath();
        ctx.arc(
          canvas.width / 2,
          canvas.height / 2,
          radius * (1 + amplitude * 0.3),
          startAngle,
          endAngle
        );

        ctx.strokeStyle = segmentColor
          .replace("{hue}", `${(freqIndex * 360) / bufferLength}`)
          .replace("{saturation}", `${70 + amplitude * 30}`)
          .replace("{alpha}", `${0.3 + amplitude * 0.7}`);
        ctx.lineWidth = 2 + amplitude * 4;
        ctx.stroke();

        if (amplitude > 0.5) {
          ctx.beginPath();
          ctx.moveTo(canvas.width / 2, canvas.height / 2);
          ctx.lineTo(
            canvas.width / 2 + radius * Math.cos(startAngle),
            canvas.height / 2 + radius * Math.sin(startAngle)
          );
          ctx.strokeStyle = segmentColor
            .replace("{hue}", `${(freqIndex * 360) / bufferLength}`)
            .replace("{saturation}", "70")
            .replace("{alpha}", `${amplitude - 0.5}`);
          ctx.stroke();
        }
      }
    }
  },
};

export default fractureSpectrogram;
