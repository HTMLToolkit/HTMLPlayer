import { VisualizerType } from "../helpers/visualizerLoader";

const crystalSpectrogram: VisualizerType = {
  name: "Crystal Formation",
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
      branchColor = "hsla({hue}, 85%, 50%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      branchCount = 6,
      subBranchCount = 3,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const branches = branchCount;

    for (let i = 0; i < bufferLength; i++) {
      const amplitude = freqDataArray[i] / 256.0;
      const baseAngle = (i * 2 * Math.PI) / bufferLength;

      for (let b = 0; b < branches; b++) {
        const angle = baseAngle + (b * 2 * Math.PI) / branches;
        const radius = Math.min(centerX, centerY) * (0.2 + amplitude * 0.8);

        const x1 = centerX + radius * Math.cos(angle);
        const y1 = centerY + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = branchColor
          .replace("{hue}", `${(i * 360) / bufferLength}`)
          .replace("{alpha}", `${0.3 + amplitude * 0.7}`);
        ctx.lineWidth = 2 + amplitude * 3;
        ctx.stroke();

        const subBranches = subBranchCount;
        for (let s = 0; s < subBranches; s++) {
          const subAngle = angle + (((s - 1) * Math.PI) / 6) * amplitude;
          const subRadius = radius * 0.3;

          const x2 = x1 + subRadius * Math.cos(subAngle);
          const y2 = y1 + subRadius * Math.sin(subAngle);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = branchColor
            .replace("{hue}", `${(i * 360) / bufferLength}`)
            .replace("{alpha}", `${0.2 + amplitude * 0.5}`);
          ctx.lineWidth = 1 + amplitude * 2;
          ctx.stroke();
        }
      }
    }
  },
};

export default crystalSpectrogram;