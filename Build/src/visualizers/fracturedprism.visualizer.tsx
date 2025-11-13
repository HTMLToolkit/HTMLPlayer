import { VisualizerType } from "../helpers/visualizerLoader";

const fracturedPrism: VisualizerType = {
  name: "Fractured Prism",
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
      lineColor = "hsla({hue}, 70%, 50%, 0.6)",
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      layerCount = 3,
      displacementScale = 30,
      jitterInterval = 5,
      jitterAmplitude = 5,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height / 2;
    const sliceWidth = canvas.width / bufferLength;

    for (let layer = 0; layer < layerCount; layer++) {
      let x = 0;
      ctx.beginPath();
      ctx.strokeStyle = lineColor.replace("{hue}", `${120 * layer}`);
      ctx.lineWidth = 2;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const displacement =
          Math.sin(i * 0.05 + (layer * Math.PI) / 3) * displacementScale;
        const y = centerY + v * displacement;

        if (i === 0) ctx.moveTo(x, y);
        else if (i % jitterInterval === 0) {
          ctx.lineTo(
            x + Math.random() * jitterAmplitude,
            y + Math.random() * jitterAmplitude,
          );
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
    }
  },
};

export default fracturedPrism;
