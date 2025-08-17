import { VisualizerType, visualizerStates } from "../helpers/visualizerLoader";

const LayeredRippleVoronoi: VisualizerType = {
  name: "Layered Ripple Voronoi",
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
      rippleColor = "hsla({hue}, 70%, 50%, 0.5)",
      pointColor = "hsla({hue}, 80%, 50%, 0.6)",
      backgroundColor = "rgba(0, 0, 0, 0.2)",
      pointCount = 20,
      pixelSize = 4,
      radiusScale = 0.8,
    } = settings;

    if (dataType !== "frequency") return;
    let state = visualizerStates.get("LayeredRippleVoronoi") || {};
    if (!state.points) {
      state = {
        points: new Array(pointCount).fill(null).map((_, i) => ({
          x: 0,
          y: 0,
          color: "",
          freqIndex: Math.floor((i * 1024) / pointCount),
        })),
        numPoints: pointCount,
        pixelSize: pixelSize,
      };
      visualizerStates.set("LayeredRippleVoronoi", state);
    }

    analyser.getByteFrequencyData(freqDataArray as any);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < bufferLength; i += 4) {
      const value = freqDataArray[i];
      const angle = (i * 2 * Math.PI) / bufferLength;
      const radius = (value / 256) * Math.min(centerX, centerY) * radiusScale;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = rippleColor.replace(
        "{hue}",
        `${(i * 360) / bufferLength}`
      );
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (let i = 0; i < state.numPoints!; i++) {
      const point = state.points![i];
      const value = freqDataArray[point.freqIndex];
      const angle = (i * 2 * Math.PI) / state.numPoints!;
      const radius = (value / 256) * Math.min(centerX, centerY) * 0.6;

      point.x = centerX + Math.cos(angle) * radius;
      point.y = centerY + Math.sin(angle) * radius;
      point.color = pointColor.replace(
        "{hue}",
        `${(point.freqIndex * 360) / bufferLength}`
      );
    }

    for (let x = 0; x < canvas.width; x += state.pixelSize!) {
      for (let y = 0; y < canvas.height; y += state.pixelSize!) {
        let minDist = Infinity;
        let closestPoint = null;

        for (let point of state.points!) {
          const dx = x - point.x;
          const dy = y - point.y;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            closestPoint = point;
          }
        }

        if (closestPoint) {
          ctx.fillStyle = closestPoint.color;
          ctx.fillRect(x, y, state.pixelSize!, state.pixelSize!);
        }
      }
    }
  },
};

export default LayeredRippleVoronoi;
