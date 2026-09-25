import {
  getByteTimeDomainData,
  sample,
  VisualizerType,
} from "../../../platform/visualizers";

interface GeometricPulseSettings {
  shapeColor?: string;
  backgroundColor?: string;
  shapeInterval?: number;
  heightScale?: number;
}

const geometricPulse: VisualizerType<GeometricPulseSettings> = {
  name: "Geometric Pulse",
  dataType: "time",
  draw: function (
    analyser,
    canvas,
    ctx,
    bufferLength,
    timeDataArray,
    dataType,
    settings = {},
  ) {
    const {
      shapeColor = "hsla({hue}, 80%, 50%, {alpha})",
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      shapeInterval = 4,
      heightScale = 0.3,
    } = settings;

    if (dataType !== "time") return;
    getByteTimeDomainData(analyser, timeDataArray);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height / 2;
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i += shapeInterval) {
      const v = sample(timeDataArray, i) / 128.0;
      const height = v * canvas.height * heightScale;

      ctx.beginPath();
      ctx.fillStyle = shapeColor
        .replace("{hue}", `${(i / bufferLength) * 360}`)
        .replace("{alpha}", `${v}`);

      ctx.moveTo(x, centerY);
      ctx.lineTo(x + sliceWidth * 2, centerY - height);
      ctx.lineTo(x + sliceWidth * 4, centerY);
      ctx.lineTo(x + sliceWidth * 2, centerY + height);
      ctx.closePath();
      ctx.fill();

      x += sliceWidth * shapeInterval;
    }
  },
};

export default geometricPulse;
