import { VisualizerType } from "../helpers/visualizerLoader";

const dnaSpectrogram: VisualizerType = {
  name: "DNA Helix Spectrogram",
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
      strandColor = "hsla({hue}, 70%, 50%, 0.8)",
      barColor = "hsla({hue}, 70%, 50%, 0.3)",
      backgroundColor = "rgb(20, 20, 20)",
      strandCount = 2,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const strands = strandCount;
    const frequency = 2;
    const points = bufferLength / strands;

    for (let strand = 0; strand < strands; strand++) {
      ctx.beginPath();

      for (let i = 0; i < points; i++) {
        const freqIndex = Math.floor(i + strand * points);
        const amplitude = freqDataArray[freqIndex] / 256.0;

        const progress = i / points;
        const x = progress * canvas.width;
        const offset = Math.PI * strand;
        const y =
          canvas.height / 2 +
          Math.sin(progress * Math.PI * 2 * frequency + offset) *
            100 *
            (0.5 + amplitude * 0.5);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        if (strand === 0) {
          const y2 =
            canvas.height / 2 +
            Math.sin(progress * Math.PI * 2 * frequency + Math.PI) *
              100 *
              (0.5 + amplitude * 0.5);

          ctx.fillStyle = barColor.replace(
            "{hue}",
            `${(freqIndex * 360) / bufferLength}`
          );
          ctx.fillRect(x, y, 2, y2 - y);
        }
      }

      ctx.strokeStyle = strandColor.replace("{hue}", `${strand * 180}`);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  },
};

export default dnaSpectrogram;
