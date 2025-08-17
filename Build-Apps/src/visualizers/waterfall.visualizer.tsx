import { VisualizerType } from "../helpers/visualizerLoader";

const waterfall: VisualizerType = {
  name: "Waterfall",
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
      hueBase = 0,
      saturation = 100,
      lightness = 50,
      scrollSpeed = 1,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    const imageData = ctx.getImageData(
      0,
      scrollSpeed,
      canvas.width,
      canvas.height - scrollSpeed
    );
    ctx.putImageData(imageData, 0, 0);

    for (let i = 0; i < bufferLength; i++) {
      const value = freqDataArray[i];
      ctx.fillStyle = `hsl(${hueBase + value}, ${saturation}%, ${lightness}%)`;
      ctx.fillRect(
        (i * canvas.width) / bufferLength,
        canvas.height - scrollSpeed,
        canvas.width / bufferLength,
        scrollSpeed
      );
    }
  },
};

export default waterfall;
