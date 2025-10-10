import { VisualizerType } from "../helpers/visualizerLoader";

const voltaicArcs: VisualizerType = {
  name: "Voltaic Arcs",
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
      lineColor = "rgba(0, {green}, {blue}, 0.8)",
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      lineWidth = 2,
      arcInterval = 10,
      arcHeightScale = 50,
    } = settings;

    if (dataType !== "time") return;
    analyser.getByteTimeDomainData(timeDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor
      .replace("{green}", `${Math.floor(255 * (timeDataArray[0] / 128.0))}`)
      .replace("{blue}", `${Math.floor(255 * (timeDataArray[0] / 128.0))}`);
    ctx.beginPath();

    for (let i = 0; i < bufferLength; i++) {
      const v = timeDataArray[i] / 128.0;
      let y = (v * canvas.height) / 2;

      if (i % arcInterval === 0) {
        const arcHeight = Math.random() * arcHeightScale * v;
        ctx.lineTo(x, y);
        ctx.lineTo(x + 5, y - arcHeight);
        ctx.lineTo(x + 10, y);
      } else {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      if (i % 20 === 0) {
        ctx.strokeStyle = lineColor
          .replace("{green}", `${Math.floor(255 * v)}`)
          .replace("{blue}", `${Math.floor(255 * v)}`);
      }

      x += sliceWidth;
    }
    ctx.stroke();
  },
};

export default voltaicArcs;
