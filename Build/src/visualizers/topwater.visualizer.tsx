import { VisualizerType, visualizerStates } from "../helpers/visualizerLoader";

const topwaterSpectrogram: VisualizerType = {
  name: "Top-Down Water Spectrogram",
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
      lineColor = "rgba(0, 255, 255, {alpha})",
      gradientColor = "rgba(0, 255, 255, {alpha})",
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      ringCount = 10,
      radiusScale = 0.4,
      waveAmplitude = 30,
      segmentStep = 4,
    } = settings;

    if (dataType !== "frequency") return;
    let state = visualizerStates.get("topwaterSpectrogram") || {};
    if (!state.config) {
      state.config = {
        sinTable: new Float32Array(360),
        initialized: false,
      };
      for (let i = 0; i < 360; i++) {
        state.config.sinTable![i] = Math.sin((i * Math.PI) / 180);
      }
      state.config.initialized = true;
      visualizerStates.set("topwaterSpectrogram", state);
    }

    analyser.getByteFrequencyData(freqDataArray as any);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentTime = Date.now() / 1000;
    const radius = Math.min(canvas.width, canvas.height) * radiusScale;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const segments = Math.floor(bufferLength / segmentStep);

    for (let ring = 0; ring < ringCount; ring++) {
      const ringRadius = radius - ring * 20;
      const alpha = 1 - ring * 0.1;

      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const freqIndex = i % bufferLength;
        const frequency = freqDataArray[freqIndex];

        const waveOffset =
          state.config!.sinTable![
            Math.floor(
              ((currentTime * 2 + ring + i / 5) % (Math.PI * 2)) *
                (180 / Math.PI)
            ) % 360
          ] * 10;
        const radiusOffset = (frequency / 255) * waveAmplitude + waveOffset;
        const currentRadius = ringRadius + radiusOffset;

        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      ctx.strokeStyle = lineColor.replace("{alpha}", `${alpha * 0.8}`);
      ctx.lineWidth = 2;
      ctx.stroke();

      const innerRadius = Math.max(0, ringRadius - 20);
      let outerRadius = Math.max(0, ringRadius + 20);
      if (outerRadius < innerRadius) {
        outerRadius = innerRadius; // avoid invalid gradient params
      }
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        innerRadius,
        centerX,
        centerY,
        outerRadius
      );
      gradient.addColorStop(
        0,
        gradientColor.replace("{alpha}", `${alpha * 0.1}`)
      );
      gradient.addColorStop(1, gradientColor.replace("{alpha}", "0"));
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  },
};

export default topwaterSpectrogram;
