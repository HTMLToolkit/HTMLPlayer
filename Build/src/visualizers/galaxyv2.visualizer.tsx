import { VisualizerType } from "../helpers/visualizerLoader";

const galaxySpectrogramV2: VisualizerType = {
  name: "Galaxy Spectrogram v2",
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

        const distance = (i / particlesPerArm) * Math.min(centerX, centerY);
        const rotation =
          arm * ((2 * Math.PI) / arms) + (i / particlesPerArm) * 4 * Math.PI;

        const x = centerX + distance * Math.cos(rotation);
        const y = centerY + distance * Math.sin(rotation);

        const size = 1 + amplitude * particleSize;

        ctx.fillStyle = particleColor
          .replace("{hue}", `${(freqIndex * 360) / bufferLength}`)
          .replace("{saturation}", `${70 + amplitude * 30}`)
          .replace("{lightness}", `${50 + amplitude * 50}`)
          .replace("{alpha}", `${0.1 + amplitude * 0.4}`);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },
};

export default galaxySpectrogramV2;
