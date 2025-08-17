import { VisualizerType } from "../helpers/visualizerLoader";

const rainbowSpiral: VisualizerType = {
  name: "Rainbow Spiral",
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
      pointColor = "hsl({hue}, 100%, 50%)",
      backgroundColor = "rgba(0, 0, 0, 0.1)",
      pointSize = 2,
      rotationSpeed = 1,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < bufferLength; i++) {
      const value = freqDataArray[i];
      const radius = (value / 256) * Math.min(centerX, centerY);
      const angle =
        (i * 2 * Math.PI) / bufferLength + Date.now() / (1000 / rotationSpeed);

      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.fillStyle = pointColor.replace(
        "{hue}",
        `${(i * 360) / bufferLength}`
      );
      ctx.beginPath();
      ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  },
};

export default rainbowSpiral;
