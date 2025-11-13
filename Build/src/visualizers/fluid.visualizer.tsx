import { VisualizerType, visualizerStates } from "../helpers/visualizerLoader";

const fluidSpectrogram: VisualizerType = {
  name: "Fluid Dynamics",
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
      particleColor = "hsla({hue}, 80%, 50%, {alpha})",
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      particleSize = 15,
      particleLife = 0.99,
      particleCount = 100,
      velocityScale = 2,
    } = settings;

    if (dataType !== "frequency") return;
    let state = visualizerStates.get("fluidSpectrogram") || {};
    if (!state.particles) {
      state.particles = new Array(particleCount).fill(null).map(() => ({
        x: canvas.width / 2 + Math.cos(Math.random() * 2 * Math.PI) * 100,
        y: canvas.height / 2 + Math.sin(Math.random() * 2 * Math.PI) * 100,
        vx: (Math.random() - 0.5) * velocityScale,
        vy: (Math.random() - 0.5) * velocityScale,
        life: 1.0,
      }));
      visualizerStates.set("fluidSpectrogram", state);
    }

    analyser.getByteFrequencyData(freqDataArray as any);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    state.particles!.forEach((p, index) => {
      const freqIndex = index % bufferLength;
      const amplitude = freqDataArray[freqIndex] / 256.0;

      p.x += p.vx * (1 + amplitude * velocityScale);
      p.y += p.vy * (1 + amplitude * velocityScale);
      p.life *= particleLife;

      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      if (p.life < 0.01) {
        p.x = canvas.width / 2 + Math.cos(Math.random() * 2 * Math.PI) * 100;
        p.y = canvas.height / 2 + Math.sin(Math.random() * 2 * Math.PI) * 100;
        p.vx = (Math.random() - 0.5) * velocityScale;
        p.vy = (Math.random() - 0.5) * velocityScale;
        p.life = 1.0;
      }

      ctx.fillStyle = particleColor
        .replace("{hue}", `${(freqIndex * 360) / bufferLength}`)
        .replace("{alpha}", `${p.life * amplitude}`);
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        particleSize * p.life * (0.5 + amplitude * 0.5),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
  },
};

export default fluidSpectrogram;
