import { VisualizerType } from "../helpers/visualizerLoader";

const fireSpectrum: VisualizerType = {
  name: "Fire Spectrum",
  dataType: "time",
  draw: function (
    analyser,
    canvas,
    ctx,
    bufferLength,
    timeDataArray,
    dataType,
    settings = {}
  ) {
    const {
      gradientColors = [
        { stop: 0, color: "#ff0000" },
        { stop: 0.5, color: "#ff8c00" },
        { stop: 1, color: "#ffff00" },
      ],
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      lineWidth = 3,
      glowIntensity = 0.5,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradientColors.forEach(({ stop, color }: any) =>
      gradient.addColorStop(stop, color)
    );

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = gradient;
    ctx.shadowBlur = 10 * glowIntensity;
    ctx.shadowColor = "#ff8c00";
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeDataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  },
};

export default fireSpectrum;
