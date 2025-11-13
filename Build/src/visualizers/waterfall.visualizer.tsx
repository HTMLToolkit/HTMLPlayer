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
    settings = {},
  ) {
    const {
      hueBase = 240, // start with blue
      saturation = 100,
      lightness = 50,
      scrollSpeed = 1, // pixel-per-frame scroll
    } = settings;

    if (dataType !== "frequency") return;

    // Get frequency data
    analyser.getByteFrequencyData(freqDataArray as any);

    // Scroll canvas up by scrollSpeed pixels
    const imageData = ctx.getImageData(
      0,
      scrollSpeed,
      canvas.width,
      canvas.height - scrollSpeed,
    );
    ctx.putImageData(imageData, 0, 0);

    // Draw new line at the bottom
    const barWidth = canvas.width / bufferLength;

    for (let i = 0; i < bufferLength; i++) {
      const value = freqDataArray[i]; // 0 - 255
      const hue = hueBase - (value / 255) * 240; // more intense = red/yellow
      const sat = saturation;
      const light = lightness;

      ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
      ctx.fillRect(
        i * barWidth,
        canvas.height - scrollSpeed,
        barWidth,
        scrollSpeed,
      );
    }
  },
};

export default waterfall;
