import { VisualizerType } from "../helpers/visualizerLoader";

const galaxySpectrogram: VisualizerType = {
  name: "Galaxy Formation",
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
      particleColor = "hsla({hue}, {saturation}%, {lightness}%, {alpha})",
      backgroundColor = "rgb(20, 20, 20)",
      armCount = 4,
      particleSize = 4,
    } = settings;

    if (dataType !== "frequency") return;
    analyser.getByteFrequencyData(freqDataArray as any);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const arms = armCount;
    const particlesPerArm = bufferLength / arms;

    for (let arm = 0; arm < arms; arm++) {
      for (let i = 0; i < particlesPerArm; i++) {
        const freqIndex = Math.floor(arm * particlesPerArm + i);
        const amplitude = freqDataArray[freqIndex] / 256.0;

        const rotation =
          (i / particlesPerArm) * 2 * Math.PI + (arm * 2 * Math.PI) / arms;
        const spiral = (i / particlesPerArm) * 5;
        const radius =
          (i / particlesPerArm) *
          Math.min(centerX, centerY) *
          (0.3 + amplitude * 0.7);

        const x = centerX + radius * Math.cos(rotation + spiral);
        const y = centerY + radius * Math.sin(rotation + spiral);

        const size = 1 + amplitude * particleSize;

        ctx.fillStyle = particleColor
          .replace("{hue}", `${(freqIndex * 360) / bufferLength}`)
          .replace("{saturation}", `${70 + amplitude * 30}`)
          .replace("{lightness}", `${50 + amplitude * 50}`)
          .replace("{alpha}", `${0.1 + amplitude * 0.6}`);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },
};

export default galaxySpectrogram;
