import { VisualizerType } from "../helpers/visualizerLoader";

const cityscape: VisualizerType = {
  name: "Dynamic Cityscape",
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
      buildingColor = "rgb(20, 20, {blue})",
      windowColor = "rgba({brightness}, {brightness}, 0, 0.8)",
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      buildingCount = 40,
      baseHeightScale = 0.2,
      windowRows = 20,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const buildingWidth = canvas.width / buildingCount;
    const baseHeight = canvas.height * baseHeightScale;

    for (let i = 0; i < buildingCount; i++) {
      const freqIndex = Math.floor((i / buildingCount) * bufferLength);
      const height = (freqDataArray[freqIndex] / 256.0) * canvas.height * 0.7;

      ctx.fillStyle = buildingColor.replace("{blue}", `${30 + height / 2}`);
      const x = i * buildingWidth;
      ctx.fillRect(
        x,
        canvas.height - height - baseHeight,
        buildingWidth - 2,
        height
      );

      const rows = Math.floor(height / windowRows);
      const cols = 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const brightness = Math.random() * 155 + 100;
          ctx.fillStyle = windowColor.replace("{brightness}", `${brightness}`);
          ctx.fillRect(
            x + col * (buildingWidth / 3) + 2,
            canvas.height - height - baseHeight + row * windowRows + 5,
            buildingWidth / 4,
            windowRows / 2
          );
        }
      }
    }
  },
};

export default cityscape;
