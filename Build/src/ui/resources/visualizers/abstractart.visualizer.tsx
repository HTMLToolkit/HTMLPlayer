import {
  getByteFrequencyData,
  sample,
  VisualizerType,
} from "../../../platform/visualizers";

interface AbstractArtSettings {
  shapeColor?: string;
  backgroundColor?: string;
  curveScale?: number;
  shapeCount?: number;
}

const abstractArt: VisualizerType<AbstractArtSettings> = {
  name: "Abstract Art",
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
      shapeColor = "hsla({hue}, 90%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      curveScale = 1,
      shapeCount = bufferLength,
    } = settings;

    if (dataType !== "frequency") return;
    getByteFrequencyData(analyser, freqDataArray);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < shapeCount; i++) {
      const amplitude = sample(freqDataArray, i) / 256.0;

      ctx.fillStyle = shapeColor
        .replace("{hue}", `${(i * 360) / bufferLength}`)
        .replace("{alpha}", `${amplitude}`);
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.bezierCurveTo(
        amplitude * canvas.width * curveScale,
        amplitude * canvas.height * curveScale,
        (1 - amplitude) * canvas.width * curveScale,
        (1 - amplitude) * canvas.height * curveScale,
        Math.random() * canvas.width,
        Math.random() * canvas.height,
      );
      ctx.fill();
    }
  },
};

export default abstractArt;
