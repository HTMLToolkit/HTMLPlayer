import {
  getByteFrequencyData,
  sample,
  VisualizerType,
} from "../../../platform/visualizers";

interface WaterfallSettings {
  hueBase?: number;
  saturation?: number;
  lightness?: number;
  scrollSpeed?: number;
}

const waterfall: VisualizerType<WaterfallSettings> = {
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
      hueBase = 240,
      saturation = 100,
      lightness = 50,
      scrollSpeed = 1,
    } = settings;

    if (dataType !== "frequency") return;

    getByteFrequencyData(analyser, freqDataArray);

    const imageData = ctx.getImageData(
      0,
      scrollSpeed,
      canvas.width,
      canvas.height - scrollSpeed,
    );
    ctx.putImageData(imageData, 0, 0);

    const barWidth = canvas.width / bufferLength;

    for (let i = 0; i < bufferLength; i++) {
      const value = sample(freqDataArray, i);
      const hue = hueBase - (value / 255) * 240;
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
