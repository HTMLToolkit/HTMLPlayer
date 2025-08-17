import { VisualizerType, visualizerStates } from "../helpers/visualizerLoader";

const waterSpectrogram: VisualizerType = {
  name: "3D Water Spectrogram",
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
      fillColor = "rgba(0, 255, 255, {alpha})",
      backgroundColor = "rgba(20, 20, 20, 0.2)",
      layerCount = 15,
      connectionStep = 4,
      waveAmplitude = 20,
    } = settings;

    if (dataType !== "frequency") return;
    let state = visualizerStates.get("waterSpectrogram") || {};
    if (!state.config) {
      state.config = {
        layers: layerCount,
        sinTable: new Float32Array(360),
        points: [],
        initialized: false,
      };
      for (let i = 0; i < 360; i++) {
        state.config.sinTable![i] = Math.sin((i * Math.PI) / 180);
      }
      state.config.initialized = true;
      visualizerStates.set("waterSpectrogram", state);
    }

    analyser.getByteFrequencyData(freqDataArray as any);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentTime = Date.now() / 1000;
    const points = state.config.points!;
    const layers = state.config.layers!;
    const connections = Math.floor(bufferLength / connectionStep);

    if (points.length !== layers) {
      points.length = 0;
      for (let z = 0; z < layers; z++) {
        points[z] = new Array(connections)
          .fill(null)
          .map(() => ({ x: 0, y: 0, z: 0, perspective: 0 }));
      }
    }

    const widthStep = canvas.width / connections;
    for (let z = 0; z < layers; z++) {
      const perspective = 1 - z * 0.05;
      const zOffset = z * 20;
      const layerPoints = points[z];

      for (let i = 0; i < connections; i++) {
        const freq = freqDataArray[i * connectionStep] * perspective;
        const point = layerPoints[i];
        point.x = widthStep * i;
        point.y =
          canvas.height / 2 +
          (freq - 128) * 1.5 * perspective +
          state.config!.sinTable![
            Math.floor(
              ((currentTime + z / 2 + i / 10) % (Math.PI * 2)) * (180 / Math.PI)
            ) % 360
          ] *
            waveAmplitude;
        point.z = zOffset;
        point.perspective = perspective;
      }
    }

    ctx.beginPath();
    for (let z = layers - 1; z >= 0; z--) {
      const currentLayer = points[z];

      for (let i = 0; i < connections - 1; i++) {
        const current = currentLayer[i];
        const next = currentLayer[i + 1];

        ctx.strokeStyle = lineColor.replace(
          "{alpha}",
          `${current.perspective * 0.8}`
        );
        ctx.lineWidth = current.perspective * 2;
        ctx.moveTo(current.x, current.y);
        ctx.lineTo(next.x, next.y);
      }

      if (z > 0) {
        const previousLayer = points[z - 1];
        ctx.strokeStyle = lineColor.replace(
          "{alpha}",
          `${currentLayer[0].perspective * 0.4}`
        );
        for (let i = 0; i < connections; i += 2) {
          const current = currentLayer[i];
          const previous = previousLayer[i];
          ctx.moveTo(current.x, current.y);
          ctx.lineTo(previous.x, previous.y);
        }
      }
    }
    ctx.stroke();

    ctx.beginPath();
    for (let z = 0; z < layers; z++) {
      const currentLayer = points[z];
      for (let i = 0; i < connections - 1; i++) {
        const current = currentLayer[i];
        const next = currentLayer[i + 1];
        ctx.moveTo(current.x, current.y);
        ctx.lineTo(next.x, next.y);
        ctx.lineTo(next.x, canvas.height);
        ctx.lineTo(current.x, canvas.height);
      }
    }
    ctx.fillStyle = fillColor.replace("{alpha}", "0.1");
    ctx.fill();
  },
};

export default waterSpectrogram;
