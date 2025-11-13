import { VisualizerType } from "../helpers/visualizerLoader";

const pixelDust: VisualizerType = {
  name: "Pixel Dust",
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
      pixelColor = "hsl({hue}, 70%, 50%)",
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      pixelSizeScale = 8,
      pixelOpacity = 1.0,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeDataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      const pixelSize = Math.abs(v - 1) * pixelSizeScale;
      ctx.fillStyle = pixelColor
        .replace("{hue}", `${(i / bufferLength) * 360}`)
        .replace("{alpha}", `${pixelOpacity}`);
      ctx.fillRect(x, y - pixelSize / 2, pixelSize, pixelSize);

      x += sliceWidth;
    }
  },
};

export default pixelDust;
