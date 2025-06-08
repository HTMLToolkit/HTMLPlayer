interface VisualizerDrawFunction {
  (
    analyser: AnalyserNode,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    bufferLength: number,
    dataArray: Uint8Array,
    dataType: 'time' | 'frequency',
    settings?: Record<string, any>
  ): void;
}

interface VisualizerType {
  name: string;
  draw: VisualizerDrawFunction;
}

interface SpectrogramTypes {
  [key: string]: VisualizerType;
}

interface VisualizerState {
  points?: { x: number; y: number; color: string; freqIndex: number }[];
  numPoints?: number;
  pixelSize?: number;
  offscreen?: HTMLCanvasElement;
  offscreenCtx?: CanvasRenderingContext2D | null;
  config?: {
    layers?: number;
    sinTable?: Float32Array;
    points?: { x: number; y: number; z: number; perspective: number }[][];
    initialized?: boolean;
  };
  particles?: { x: number; y: number; vx: number; vy: number; life: number }[];
}

const visualizerStates: Map<string, VisualizerState> = new Map();

export const spectrogramTypes: SpectrogramTypes = {
  oscilloscope: {
    name: 'Oscilloscope',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgb(0, 255, 0)',
        backgroundColor = 'rgb(20, 20, 20)',
        lineWidth = 3,
        glowIntensity = 0.5
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor;
      ctx.shadowBlur = 10 * glowIntensity;
      ctx.shadowColor = lineColor;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  },

  circularSpectrogram: {
    name: 'Circular Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        baseColor = 'hsl({hue}, 100%, 50%)',
        backgroundColor = 'rgb(20, 20, 20)',
        pointSize = 3,
        radiusScale = 1.0
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) * radiusScale - 10;

      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / bufferLength;
        const amplitude = freqDataArray[i] / 256.0;
        const x = centerX + radius * amplitude * Math.cos(angle);
        const y = centerY + radius * amplitude * Math.sin(angle);

        ctx.fillStyle = baseColor.replace('{hue}', `${i * 360 / bufferLength}`);
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  waterfall: {
    name: 'Waterfall',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        hueBase = 0,
        saturation = 100,
        lightness = 50,
        scrollSpeed = 1
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      const imageData = ctx.getImageData(0, scrollSpeed, canvas.width, canvas.height - scrollSpeed);
      ctx.putImageData(imageData, 0, 0);

      for(let i = 0; i < bufferLength; i++) {
        const value = freqDataArray[i];
        ctx.fillStyle = `hsl(${hueBase + value}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(i * canvas.width / bufferLength,
          canvas.height - scrollSpeed,
          canvas.width / bufferLength,
          scrollSpeed);
      }
    }
  },

  barGraph: {
    name: 'Bar Graph',
    draw: function(analyser, canvas, ctx, bufferLength, dataArray, dataType, settings = {}) {
      const {
        barColor = 'hsl({hue}, 80%, 50%)',
        backgroundColor = 'rgb(20, 20, 20)',
        barSpacing = 1,
        shadowBlur = 5
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) - barSpacing;
      let x = 0;

      for(let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = barColor.replace('{hue}', `${i * 360 / bufferLength}`);
        ctx.shadowBlur = shadowBlur;
        ctx.shadowColor = ctx.fillStyle as string;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + barSpacing;
      }
      ctx.shadowBlur = 0;
    }
  },

  spiralSpectrogram: {
    name: 'Spiral Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsl({hue}, 100%, 50%)',
        backgroundColor = 'rgb(20, 20, 20)',
        pointSize = 5,
        spiralTightness = 0.1
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      let radius = 10;

      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / 64;
        const amplitude = freqDataArray[i] / 256.0;
        radius += spiralTightness;

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.fillStyle = pointColor.replace('{hue}', `${freqDataArray[i]}`);
        ctx.beginPath();
        ctx.arc(x, y, amplitude * pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  waveformSpectrum: {
    name: 'Waveform Spectrum',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgb(0, 255, 0)',
        backgroundColor = 'rgb(20, 20, 20)',
        lineWidth = 2,
        glowIntensity = 0.5
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);

      for(let i = 0; i < bufferLength; i++) {
        const x = i * canvas.width / bufferLength;
        const y = (freqDataArray[i] / 256.0) * canvas.height;
        ctx.lineTo(x, y);
      }

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor;
      ctx.shadowBlur = 10 * glowIntensity;
      ctx.shadowColor = lineColor;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  },

  rainbowSpiral: {
    name: 'Rainbow Spiral',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsl({hue}, 100%, 50%)',
        backgroundColor = 'rgba(0, 0, 0, 0.1)',
        pointSize = 2,
        rotationSpeed = 1
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for(let i = 0; i < bufferLength; i++) {
        const value = freqDataArray[i];
        const radius = (value / 256) * Math.min(centerX, centerY);
        const angle = (i * 2 * Math.PI / bufferLength) + (Date.now() / (1000 / rotationSpeed));

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.fillStyle = pointColor.replace('{hue}', `${i * 360 / bufferLength}`);
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  pulsingOrbs: {
    name: 'Pulsing Orbs',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        orbColor = 'hsl({hue}, 80%, 50%)',
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        orbCount = 12,
        maxRadius = 0.5
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const spacing = canvas.width / orbCount;

      for(let i = 0; i < orbCount; i++) {
        const freqIndex = Math.floor(i * bufferLength / orbCount);
        const value = freqDataArray[freqIndex];
        const radius = (value / 256) * spacing * maxRadius;

        ctx.fillStyle = orbColor.replace('{hue}', `${i * 360 / orbCount}`);
        ctx.beginPath();
        ctx.arc(spacing * (i + 0.5), canvas.height / 2, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  frequencyMesh: {
    name: 'Frequency Mesh',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgba(0, 255, 255, 0.5)',
        backgroundColor = 'black',
        pointCount = 20,
        lineWidth = 1
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const points = [];
      const numPoints = pointCount;

      for(let i = 0; i < numPoints; i++) {
        const freqIndex = Math.floor(i * bufferLength / numPoints);
        const value = freqDataArray[freqIndex] / 256;
        points.push({
          x: (canvas.width * i) / (numPoints - 1),
          y: canvas.height / 2 + (value - 0.5) * canvas.height
        });
      }

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for(let i = 0; i < points.length; i++) {
        for(let j = i + 1; j < points.length; j++) {
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
        }
      }
      ctx.stroke();
    }
  },

  kaleidoscope: {
    name: 'Kaleidoscope',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsl({hue}, 100%, 50%)',
        backgroundColor = 'rgba(0, 0, 0, 0.1)',
        segmentCount = 8,
        pointSize = 2
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const segments = segmentCount;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(let i = 0; i < bufferLength; i += 4) {
        const value = freqDataArray[i];
        const radius = (value / 256) * Math.min(centerX, centerY);

        for(let s = 0; s < segments; s++) {
          const angle = (s * 2 * Math.PI / segments) + (i * Math.PI / bufferLength);
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          ctx.fillStyle = pointColor.replace('{hue}', `${i * 360 / bufferLength}`);
          ctx.beginPath();
          ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  },

  voronoiSpectrum: {
    name: 'Voronoi Spectrum',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointCount = 20,
        pixelSize = 4,
        backgroundColor = 'rgba(0, 0, 0, 0.1)',
        pointColor = 'hsl({hue}, 100%, {lightness}%)'
      } = settings;

      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('voronoiSpectrum') || {};
      if (!state.points) {
        state = {
          points: new Array(pointCount).fill(null).map((_, i) => ({
            x: 0,
            y: 0,
            color: '',
            freqIndex: Math.floor((i * 1024) / pointCount),
          })),
          numPoints: pointCount,
          pixelSize: pixelSize,
          offscreen: document.createElement('canvas'),
          offscreenCtx: null as CanvasRenderingContext2D | null,
        };
        state.offscreen!.width = canvas.width;
        state.offscreen!.height = canvas.height;
        state.offscreenCtx = state.offscreen!.getContext('2d');
        visualizerStates.set('voronoiSpectrum', state);
      }

      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < state.numPoints!; i++) {
        const point = state.points![i];
        point.x = Math.random() * canvas.width;
        point.y = Math.random() * canvas.height;
        const value = freqDataArray[point.freqIndex] / 256;
        point.color = pointColor.replace('{hue}', `${point.freqIndex * 360 / bufferLength}`)
                               .replace('{lightness}', `${value * 100}`);
      }

      state.offscreenCtx!.clearRect(0, 0, canvas.width, canvas.height);

      for (let x = 0; x < canvas.width; x += state.pixelSize!) {
        for (let y = 0; y < canvas.height; y += state.pixelSize!) {
          let minDist = Infinity;
          let closestColor = '';

          for (let p of state.points!) {
            const dx = x - p.x;
            const dy = y - p.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
              minDist = dist;
              closestColor = p.color;
            }
          }

          state.offscreenCtx!.fillStyle = closestColor;
          state.offscreenCtx!.fillRect(x, y, state.pixelSize!, state.pixelSize!);
        }
      }

      ctx.drawImage(state.offscreen!, 0, 0);
    }
  },

  waveformTunnel: {
    name: 'Waveform Tunnel',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = 'hsl({hue}, 100%, 50%)',
        backgroundColor = 'rgba(0, 0, 0, 0.1)',
        lineWidth = 2,
        radiusStep = 10
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY);

      for(let radius = maxRadius; radius > 0; radius -= radiusStep) {
        ctx.beginPath();
        for(let i = 0; i < bufferLength; i++) {
          const angle = (i * 2 * Math.PI) / bufferLength;
          const value = timeDataArray[i] / 128.0 - 1;
          const r = radius + value * 20;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);

          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = lineColor.replace('{hue}', `${radius * 360 / maxRadius}`);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }
  },

  frequencyStars: {
    name: 'Frequency Stars',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        starColor = 'hsl({hue}, 100%, 80%)',
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        starSize = 4,
        threshold = 128
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(let i = 0; i < bufferLength; i++) {
        const value = freqDataArray[i];
        if(value > threshold) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = (value - threshold) / 32 * starSize;

          ctx.fillStyle = starColor.replace('{hue}', `${i * 360 / bufferLength}`);
          ctx.beginPath();
          for(let j = 0; j < 5; j++) {
            const angle = (j * 4 * Math.PI) / 5;
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            if(j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  },

  circularWave: {
    name: 'Circular Wave',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = 'hsl({hue}, 100%, 50%)',
        backgroundColor = 'rgba(0, 0, 0, 0.1)',
        lineWidth = 2,
        waveAmplitude = 50
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) * 0.8;

      ctx.beginPath();
      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / bufferLength;
        const value = timeDataArray[i] / 128.0 - 1;
        const r = radius + value * waveAmplitude;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);

        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = lineColor.replace('{hue}', `${Date.now() / 50 % 360}`);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  },

  spectrumRipple: {
    name: 'Spectrum Ripple',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        rippleColor = 'hsla({hue}, 100%, 50%, 0.5)',
        backgroundColor = 'rgba(0, 0, 0, 0.1)',
        lineWidth = 2,
        rippleStep = 4
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for(let i = 0; i < bufferLength; i += rippleStep) {
        const value = freqDataArray[i];
        const angle = (i * 2 * Math.PI) / bufferLength;
        const radius = (value / 256) * Math.min(centerX, centerY);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = rippleColor.replace('{hue}', `${i * 360 / bufferLength}`);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }
  },

  frequencyFlower: {
    name: 'Frequency Flower',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'hsl({hue}, 100%, 50%)',
        backgroundColor = 'rgba(0, 0, 0, 0.1)',
        lineWidth = 2,
        petalCount = 8
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(centerX, centerY) * 0.3;

      ctx.beginPath();
      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / bufferLength;
        const value = freqDataArray[i] / 256;
        const radius = baseRadius + value * baseRadius * Math.sin(petalCount * angle);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = lineColor.replace('{hue}', `${Date.now() / 30 % 360}`);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  },

  spiralSpectrogramV2: {
    name: 'Spiral Spectrogram v2',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsl({hue}, {saturation}%, 50%)',
        backgroundColor = 'rgb(20, 20, 20)',
        pointSize = 2,
        spiralTightness = 0.5
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY);

      for(let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * 2 * Math.PI) / 64;
        const radius = (i / bufferLength) * maxRadius * spiralTightness + (amplitude * 50);

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.fillStyle = pointColor.replace('{hue}', `${i * 360 / bufferLength}`)
                                .replace('{saturation}', `${amplitude * 100}`);
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  flowerSpectrogram: {
    name: 'Flower Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsla({hue}, 80%, 50%, 0.6)',
        backgroundColor = 'rgb(20, 20, 20)',
        pointSize = 3,
        petalCount = 12
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for(let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * 2 * Math.PI) / bufferLength;
        const radius = Math.min(centerX, centerY) * amplitude;

        const petalAngle = angle * petalCount;
        const x = centerX + radius * Math.cos(petalAngle);
        const y = centerY + radius * Math.sin(petalAngle);

        ctx.fillStyle = pointColor.replace('{hue}', `${i * 360 / bufferLength}`);
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  waveformRings: {
    name: 'Waveform Rings',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        ringColor = 'hsla({hue}, 70%, 50%, 0.5)',
        backgroundColor = 'rgb(20, 20, 20)',
        ringCount = 5,
        lineWidth = 2
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const rings = ringCount;

      for(let ring = 0; ring < rings; ring++) {
        const baseRadius = (ring + 1) * (Math.min(centerX, centerY) / rings);

        ctx.beginPath();
        for(let i = 0; i < bufferLength; i++) {
          const amplitude = freqDataArray[i] / 256.0;
          const angle = (i * 2 * Math.PI) / bufferLength;
          const radius = baseRadius + (amplitude * 20);

          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          if(i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.strokeStyle = ringColor.replace('{hue}', `${ring * 360 / rings}`);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }
  },

  particleField: {
    name: 'Particle Field',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        particleColor = 'hsla({hue}, {saturation}%, {lightness}%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        particleCount = 100,
        baseRadius = 0.25
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const particles = particleCount;
      const radius = Math.min(canvas.width, canvas.height) * baseRadius;

      for(let i = 0; i < particles; i++) {
        const freqIndex = Math.floor((i / particles) * bufferLength);
        const amplitude = freqDataArray[freqIndex] / 256.0;
        const angle = (i * 2 * Math.PI) / particles;

        const particleRadius = radius + (amplitude * 100);
        const x = canvas.width/2 + particleRadius * Math.cos(angle);
        const y = canvas.height/2 + particleRadius * Math.sin(angle);

        const size = 2 + amplitude * 5;

        ctx.fillStyle = particleColor.replace('{hue}', `${freqIndex * 360 / bufferLength}`)
                                   .replace('{saturation}', `${80 + amplitude * 20}`)
                                   .replace('{lightness}', `${50 + amplitude * 50}`)
                                   .replace('{alpha}', `${0.3 + amplitude * 0.7}`);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  fracturedCircle: {
    name: 'Fractured Circle',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        segmentColor = 'hsl({hue}, 70%, 50%)',
        backgroundColor = 'rgb(20, 20, 20)',
        segmentCount = 32,
        lineWidth = 3
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const segments = segmentCount;

      for(let i = 0; i < segments; i++) {
        const freqIndex = Math.floor((i / segments) * bufferLength);
        const amplitude = freqDataArray[freqIndex] / 256.0;
        const startAngle = (i * 2 * Math.PI) / segments;
        const endAngle = ((i + 1) * 2 * Math.PI) / segments;

        const radius = Math.min(centerX, centerY) * (0.5 + amplitude * 0.5);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = segmentColor.replace('{hue}', `${i * 360 / segments}`);
        ctx.lineWidth = lineWidth + amplitude * 5;
        ctx.stroke();
      }
    }
  },

  kaleidoscopeSpectrogram: {
    name: 'Kaleidoscope Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsla({hue}, 85%, 50%, 0.5)',
        backgroundColor = 'rgb(20, 20, 20)',
        mirrorCount = 8,
        pointSize = 3
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const mirrors = mirrorCount;

      for(let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const baseAngle = (i * 2 * Math.PI) / bufferLength;
        const radius = Math.min(centerX, centerY) * amplitude;

        for(let m = 0; m < mirrors; m++) {
          const angle = baseAngle + (m * 2 * Math.PI / mirrors);
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          ctx.fillStyle = pointColor.replace('{hue}', `${i * 360 / bufferLength}`);
          ctx.beginPath();
          ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  },

  vortexSpectrogram: {
    name: 'Vortex Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsla({hue}, 90%, {lightness}%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        pointSize = 2,
        vortexScale = 0.5
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY);

      for(let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * 8 * Math.PI) / bufferLength;
        const radius = (i / bufferLength) * maxRadius * (1 + amplitude * vortexScale);

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.fillStyle = pointColor.replace('{hue}', `${i * 360 / bufferLength}`)
                                .replace('{lightness}', `${40 + amplitude * 60}`)
                                .replace('{alpha}', `${0.1 + amplitude * 0.6}`);
        ctx.beginPath();
        ctx.arc(x, y, pointSize + amplitude * 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  ribbonDance: {
    name: 'Ribbon Dance',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        ribbonColor = 'hsla({hue}, 70%, 50%, 0.6)',
        backgroundColor = 'rgb(20, 20, 20)',
        ribbonCount = 3,
        lineWidth = 3
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const ribbons = ribbonCount;
      const points = bufferLength / ribbons;

      for(let r = 0; r < ribbons; r++) {
        ctx.beginPath();
        for(let i = 0; i < points; i++) {
          const freqIndex = Math.floor(i + r * points);
          const amplitude = freqDataArray[freqIndex] / 256.0;

          const x = (i / points) * canvas.width;
          const y = canvas.height/2 + Math.sin(i * 0.1 + r * 2) * 100 * amplitude;

          if(i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = ribbonColor.replace('{hue}', `${r * 120}`);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }
  },

  constellationSpectrogram: {
    name: 'Constellation Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsla({hue}, 80%, 50%, {alpha})',
        lineColor = 'hsla({hue}, 70%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        connectionCount = 3
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const points = [];
      const connections = connectionCount;

      for(let i = 0; i < bufferLength; i += 2) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * 2 * Math.PI) / bufferLength;
        const radius = Math.min(canvas.width, canvas.height) / 3 * (0.5 + amplitude * 0.5);

        points.push({
          x: canvas.width/2 + radius * Math.cos(angle),
          y: canvas.height/2 + radius * Math.sin(angle),
          amplitude: amplitude
        });
      }

      for(let i = 0; i < points.length; i++) {
        const p1 = points[i];

        for(let j = 0; j < connections; j++) {
          const nextIndex = (i + j + 1) % points.length;
          const p2 = points[nextIndex];

          const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if(distance < 100) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = lineColor.replace('{hue}', `${i * 360 / points.length}`)
                                   .replace('{alpha}', `${0.15 + (p1.amplitude + p2.amplitude) * 0.2}`);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        ctx.fillStyle = pointColor.replace('{hue}', `${i * 360 / points.length}`)
                                .replace('{alpha}', `${0.3 + p1.amplitude * 0.7}`);
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 2 + p1.amplitude * 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  neuroSpectrogram: {
    name: 'Neural Network Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        nodeColor = 'hsla({hue}, 80%, 50%, {alpha})',
        lineColor = 'hsla({hue}, 70%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        nodesPerLayer = 8
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const layers = 3;
      const nodeSpacing = canvas.width / (layers + 1);
      const verticalSpacing = canvas.height / (nodesPerLayer + 1);

      const nodes = [];

      for(let layer = 0; layer < layers; layer++) {
        for(let node = 0; node < nodesPerLayer; node++) {
          const freqIndex = (layer * nodesPerLayer + node) % bufferLength;
          const amplitude = freqDataArray[freqIndex] / 256.0;

          nodes.push({
            x: nodeSpacing * (layer + 1),
            y: verticalSpacing * (node + 1),
            amplitude: amplitude
          });
        }
      }

      for(let i = 0; i < nodes.length; i++) {
        const node1 = nodes[i];
        const layer1 = Math.floor(i / nodesPerLayer);

        if(layer1 < layers - 1) {
          for(let j = 0; j < nodesPerLayer; j++) {
            const nextIndex = (layer1 + 1) * nodesPerLayer + j;
            const node2 = nodes[nextIndex];

            const strength = (node1.amplitude + node2.amplitude) / 2;

            ctx.beginPath();
            ctx.moveTo(node1.x, node1.y);
            ctx.lineTo(node2.x, node2.y);
            ctx.strokeStyle = lineColor.replace('{hue}', `${i * 360 / nodes.length}`)
                                   .replace('{alpha}', `${0.1 + strength * 0.3}`);
            ctx.lineWidth = strength * 2;
            ctx.stroke();
          }
        }

        ctx.fillStyle = nodeColor.replace('{hue}', `${i * 360 / nodes.length}`)
                                .replace('{alpha}', `${0.3 + node1.amplitude * 0.7}`);
        ctx.beginPath();
        ctx.arc(node1.x, node1.y, 3 + node1.amplitude * 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  crystalSpectrogram: {
    name: 'Crystal Formation',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        branchColor = 'hsla({hue}, 85%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        branchCount = 6,
        subBranchCount = 3
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const branches = branchCount;

      for(let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const baseAngle = (i * 2 * Math.PI) / bufferLength;

        for(let b = 0; b < branches; b++) {
          const angle = baseAngle + (b * 2 * Math.PI / branches);
          const radius = Math.min(centerX, centerY) * (0.2 + amplitude * 0.8);

          const x1 = centerX + radius * Math.cos(angle);
          const y1 = centerY + radius * Math.sin(angle);

          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(x1, y1);
          ctx.strokeStyle = branchColor.replace('{hue}', `${i * 360 / bufferLength}`)
                                    .replace('{alpha}', `${0.3 + amplitude * 0.7}`);
          ctx.lineWidth = 2 + amplitude * 3;
          ctx.stroke();

          const subBranches = subBranchCount;
          for(let s = 0; s < subBranches; s++) {
            const subAngle = angle + (s - 1) * Math.PI / 6 * amplitude;
            const subRadius = radius * 0.3;

            const x2 = x1 + subRadius * Math.cos(subAngle);
            const y2 = y1 + subRadius * Math.sin(subAngle);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = branchColor.replace('{hue}', `${i * 360 / bufferLength}`)
                                      .replace('{alpha}', `${0.2 + amplitude * 0.5}`);
            ctx.lineWidth = 1 + amplitude * 2;
            ctx.stroke();
          }
        }
      }
    }
  },

  fluidWaveSpectrogram: {
    name: 'Fluid Wave',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        waveColor = 'hsla({hue}, 70%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        layerCount = 4,
        lineWidth = 3
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const layers = layerCount;

      for(let l = 0; l < layers; l++) {
        ctx.beginPath();
        const layerOffset = (l * canvas.height) / layers;

        for(let i = 0; i <= bufferLength; i++) {
          const x = (i / bufferLength) * canvas.width;
          const freqIndex = i % bufferLength;
          const amplitude = freqDataArray[freqIndex] / 256.0;

          const wave1 = Math.sin(i * 0.1 + l * 0.5) * 30 * amplitude;
          const wave2 = Math.cos(i * 0.05 + l * 0.3) * 20 * amplitude;
          const y = layerOffset + wave1 + wave2;

          if(i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        const gradient = ctx.createLinearGradient(0, layerOffset - 50, 0, layerOffset + 50);
        gradient.addColorStop(0, waveColor.replace('{hue}', `${l * 90}`).replace('{alpha}', '0'));
        gradient.addColorStop(0.5, waveColor.replace('{hue}', `${l * 90}`).replace('{alpha}', '0.3'));
        gradient.addColorStop(1, waveColor.replace('{hue}', `${l * 90}`).replace('{alpha}', '0'));

        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }
  },

  galaxySpectrogram: {
    name: 'Galaxy Formation',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        particleColor = 'hsla({hue}, {saturation}%, {lightness}%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        armCount = 4,
        particleSize = 4
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const arms = armCount;
      const particlesPerArm = bufferLength / arms;

      for(let arm = 0; arm < arms; arm++) {
        for(let i = 0; i < particlesPerArm; i++) {
          const freqIndex = Math.floor(arm * particlesPerArm + i);
          const amplitude = freqDataArray[freqIndex] / 256.0;

          const rotation = (i / particlesPerArm) * 2 * Math.PI + (arm * 2 * Math.PI / arms);
          const spiral = (i / particlesPerArm) * 5;
          const radius = (i / particlesPerArm) * Math.min(centerX, centerY) * (0.3 + amplitude * 0.7);

          const x = centerX + radius * Math.cos(rotation + spiral);
          const y = centerY + radius * Math.sin(rotation + spiral);

          const size = 1 + amplitude * particleSize;

          ctx.fillStyle = particleColor.replace('{hue}', `${freqIndex * 360 / bufferLength}`)
                                     .replace('{saturation}', `${70 + amplitude * 30}`)
                                     .replace('{lightness}', `${50 + amplitude * 50}`)
                                     .replace('{alpha}', `${0.1 + amplitude * 0.6}`);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  },

  dnaSpectrogram: {
    name: 'DNA Helix Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        strandColor = 'hsla({hue}, 70%, 50%, 0.8)',
        barColor = 'hsla({hue}, 70%, 50%, 0.3)',
        backgroundColor = 'rgb(20, 20, 20)',
        strandCount = 2
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const strands = strandCount;
      const frequency = 2;
      const points = bufferLength / strands;

      for(let strand = 0; strand < strands; strand++) {
        ctx.beginPath();

        for(let i = 0; i < points; i++) {
          const freqIndex = Math.floor(i + strand * points);
          const amplitude = freqDataArray[freqIndex] / 256.0;

          const progress = i / points;
          const x = progress * canvas.width;
          const offset = Math.PI * strand;
          const y = canvas.height/2 + Math.sin(progress * Math.PI * 2 * frequency + offset) * 100 * (0.5 + amplitude * 0.5);

          if(i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          if(strand === 0) {
            const y2 = canvas.height/2 + Math.sin(progress * Math.PI * 2 * frequency + Math.PI) * 100 * (0.5 + amplitude * 0.5);

            ctx.fillStyle = barColor.replace('{hue}', `${freqIndex * 360 / bufferLength}`);
            ctx.fillRect(x, y, 2, y2 - y);
          }
        }

        ctx.strokeStyle = strandColor.replace('{hue}', `${strand * 180}`);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  },

  galaxySpectrogramV2: {
    name: 'Galaxy Spectrogram v2',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        particleColor = 'hsla({hue}, {saturation}%, {lightness}%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        armCount = 4,
        particleSize = 4
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const arms = armCount;
      const particlesPerArm = bufferLength / arms;

      for(let arm = 0; arm < arms; arm++) {
        for(let i = 0; i < particlesPerArm; i++) {
          const freqIndex = Math.floor(arm * particlesPerArm + i);
          const amplitude = freqDataArray[freqIndex] / 256.0;

          const distance = (i / particlesPerArm) * Math.min(centerX, centerY);
          const rotation = arm * (2 * Math.PI / arms) + (i / particlesPerArm) * 4 * Math.PI;

          const x = centerX + distance * Math.cos(rotation);
          const y = centerY + distance * Math.sin(rotation);

          const size = 1 + amplitude * particleSize;

          ctx.fillStyle = particleColor.replace('{hue}', `${freqIndex * 360 / bufferLength}`)
                                     .replace('{saturation}', `${70 + amplitude * 30}`)
                                     .replace('{lightness}', `${50 + amplitude * 50}`)
                                     .replace('{alpha}', `${0.1 + amplitude * 0.4}`);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  },

  fractureSpectrogram: {
    name: 'Fracture Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        segmentColor = 'hsla({hue}, {saturation}%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        segmentCount = 16,
        layerCount = 4
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const segments = segmentCount;
      const layers = layerCount;

      for(let layer = 0; layer < layers; layer++) {
        const radius = (layer + 1) * Math.min(canvas.width, canvas.height) / (layers * 2);

        for(let i = 0; i < segments; i++) {
          const freqIndex = (layer * segments + i) % bufferLength;
          const amplitude = freqDataArray[freqIndex] / 256.0;

          const startAngle = (i * 2 * Math.PI / segments) + (layer * Math.PI / (layers * 2));
          const endAngle = ((i + 1) * 2 * Math.PI / segments) + (layer * Math.PI / (layers * 2));

          ctx.beginPath();
          ctx.arc(canvas.width/2, canvas.height/2, radius * (1 + amplitude * 0.3), startAngle, endAngle);

          ctx.strokeStyle = segmentColor.replace('{hue}', `${freqIndex * 360 / bufferLength}`)
                                      .replace('{saturation}', `${70 + amplitude * 30}`)
                                      .replace('{alpha}', `${0.3 + amplitude * 0.7}`);
          ctx.lineWidth = 2 + amplitude * 4;
          ctx.stroke();

          if(amplitude > 0.5) {
            ctx.beginPath();
            ctx.moveTo(canvas.width/2, canvas.height/2);
            ctx.lineTo(canvas.width/2 + radius * Math.cos(startAngle), canvas.height/2 + radius * Math.sin(startAngle));
            ctx.strokeStyle = segmentColor.replace('{hue}', `${freqIndex * 360 / bufferLength}`)
                                        .replace('{saturation}', '70')
                                        .replace('{alpha}', `${amplitude - 0.5}`);
            ctx.stroke();
          }
        }
      }
    }
  },

  weatherSpectrogram: {
    name: 'Weather Pattern Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        cloudColor = 'rgba(255, 255, 255, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        cloudHeight = 0.33,
        curveScale = 100
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const height = canvas.height * cloudHeight;
      for(let i = 0; i < bufferLength; i++) {
        const x = (i * canvas.width) / bufferLength;
        const amplitude = freqDataArray[i] / 256.0;

        ctx.fillStyle = cloudColor.replace('{alpha}', `${amplitude}`);
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.quadraticCurveTo(
          x + 10,
          height - (amplitude * curveScale),
          x + 20,
          height
        );
        ctx.fill();
      }
    }
  },

  tessellationSpectrogram: {
    name: 'Tessellation Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        tileColor = 'hsla({hue}, 70%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        tileSize = 30,
        tileShape = 'hexagon'
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(let i = 0; i < bufferLength; i++) {
        const x = (i % (canvas.width / tileSize)) * tileSize;
        const y = Math.floor(i / (canvas.width / tileSize)) * tileSize;
        const amplitude = freqDataArray[i] / 256.0;

        ctx.fillStyle = tileColor.replace('{hue}', `${amplitude * 360}`)
                               .replace('{alpha}', `${amplitude}`);
        ctx.beginPath();
        if (tileShape === 'hexagon') {
          for(let j = 0; j < 6; j++) {
            const angle = j * Math.PI / 3;
            const px = x + tileSize * Math.cos(angle);
            const py = y + tileSize * Math.sin(angle);
            j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
        } else {
          ctx.rect(x, y, tileSize, tileSize);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  },

  organicSpectrogram: {
    name: 'Organic Growth Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsla({hue}, 80%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        pointSize = 5,
        growthAngle = 137.5
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * growthAngle) * Math.PI / 180;
        const amplitude = freqDataArray[i] / 256.0;
        const radius = amplitude * i / 2;

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.fillStyle = pointColor.replace('{hue}', `${i * 360 / bufferLength}`)
                                .replace('{alpha}', `${amplitude}`);
        ctx.beginPath();
        ctx.arc(x, y, amplitude * pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  interferenceSpectrogram: {
    name: 'Wave Interference Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsla({hue}, 70%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        pointSize = 2,
        waveSpacing = 20
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(let i = 0; i < bufferLength; i++) {
        const x = (i * canvas.width) / bufferLength;
        const amplitude = freqDataArray[i] / 256.0;

        for(let j = 0; j < canvas.height; j += waveSpacing) {
          const wave1 = Math.sin(x / 50 + amplitude * 10) * 10;
          const wave2 = Math.cos(x / 30) * 10;
          const interference = wave1 + wave2;

          ctx.fillStyle = pointColor.replace('{hue}', `${j + interference * 10}`)
                                  .replace('{alpha}', `${amplitude}`);
          ctx.beginPath();
          ctx.arc(x, j + interference, pointSize, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  },

  abstractSpectrogram: {
    name: 'Abstract Art Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        shapeColor = 'hsla({hue}, 90%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        curveScale = 1,
        shapeCount = bufferLength
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(let i = 0; i < shapeCount; i++) {
        const amplitude = freqDataArray[i] / 256.0;

        ctx.fillStyle = shapeColor.replace('{hue}', `${i * 360 / bufferLength}`)
                                .replace('{alpha}', `${amplitude}`);
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.bezierCurveTo(
          amplitude * canvas.width * curveScale,
          amplitude * canvas.height * curveScale,
          (1 - amplitude) * canvas.width * curveScale,
          (1 - amplitude) * canvas.height * curveScale,
          Math.random() * canvas.width,
          Math.random() * canvas.height
        );
        ctx.fill();
      }
    }
  },

  crystalSpectrogramV2: {
    name: 'Crystalline Formation',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'hsla({hue}, 90%, 70%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        lineCount = 5,
        radiusScale = 200
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for(let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * 72) * Math.PI / 180;

        for(let j = 0; j < lineCount; j++) {
          const radius = amplitude * radiusScale + (j * 30);
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          ctx.strokeStyle = lineColor.replace('{hue}', `${i * 360 / bufferLength}`)
                                  .replace('{alpha}', `${amplitude}`);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    }
  },

  neuralSpectrogram: {
    name: 'Neural Network Visualization',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        nodeColor = 'rgba(0, 255, 255, {alpha})',
        lineColor = 'rgba(0, 255, 255, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        connectionDistance = 100
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const nodes = [];
      const connections = Math.floor(bufferLength / 4);

      for(let i = 0; i < connections; i++) {
        const x = (canvas.width / connections) * i;
        const y = canvas.height / 2 + (freqDataArray[i] - 128) * 1.5;
        nodes.push({x, y});

        for(let j = 0; j < nodes.length; j++) {
          const distance = Math.hypot(nodes[j].x - x, nodes[j].y - y);
          if(distance < connectionDistance) {
            const opacity = 1 - (distance / connectionDistance);
            ctx.strokeStyle = lineColor.replace('{alpha}', `${opacity}`);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
    }
  },

  dnaSpectrogramV2: {
    name: 'DNA Helix',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'hsla({hue}, 70%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        frequency = 0.02,
        amplitudeScale = 100
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(let i = 0; i < bufferLength; i++) {
        const t = i * 5;
        const wave1 = Math.sin(t * frequency) * amplitudeScale;
        const wave2 = Math.sin(t * frequency + Math.PI) * amplitudeScale;

        const x1 = t + canvas.width/4;
        const y1 = canvas.height/2 + wave1;
        const x2 = t + canvas.width/4;
        const y2 = canvas.height/2 + wave2;

        const intensity = freqDataArray[i] / 256.0;

        ctx.strokeStyle = lineColor.replace('{hue}', `${i}`)
                                 .replace('{alpha}', `${intensity}`);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  },

  nebulaSpectrogram: {
    name: 'Cosmic Nebula',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        nebulaColor = 'hsla({hue}, 80%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        radiusScale = 200,
        pointSize = 50
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 0,
        canvas.width/2, canvas.height/2, canvas.width/2
      );

      for(let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * Math.PI * 2) / bufferLength;

        const x = canvas.width/2 + Math.cos(angle) * (amplitude * radiusScale);
        const y = canvas.height/2 + Math.sin(angle) * (amplitude * radiusScale);

        ctx.fillStyle = nebulaColor.replace('{hue}', `${270 + i}`)
                                 .replace('{alpha}', `${amplitude * 0.1}`);
        ctx.beginPath();
        ctx.arc(x, y, amplitude * pointSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  circuitSpectrogram: {
    name: 'Circuit Board',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        circuitColor = 'rgba(0, 255, 0, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        gridSize = 20,
        nodeSize = 3
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const x = (i % (canvas.width / gridSize)) * gridSize;
        const y = Math.floor(i / (canvas.width / gridSize)) * gridSize;

        ctx.strokeStyle = circuitColor.replace('{alpha}', `${amplitude}`);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);

        if(amplitude > 0.5) {
          ctx.lineTo(x + gridSize, y);
          ctx.lineTo(x + gridSize, y + gridSize);
        } else {
          ctx.lineTo(x, y + gridSize);
          ctx.lineTo(x + gridSize, y + gridSize);
        }

        ctx.stroke();

        ctx.fillStyle = circuitColor.replace('{alpha}', `${amplitude}`);
        ctx.beginPath();
        ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  fractalSpectrogram: {
    name: 'Fractal Tree',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        branchColor = 'hsla({hue}, 70%, 50%, {alpha})',
        backgroundColor = 'rgb(20, 20, 20)',
        branchDepth = 9,
        branchLength = 100
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawBranch = (startX: number, startY: number, len: number, angle: number, depth: number, amplitude: number) => {
        if (depth === 0) return;

        const endX = startX + len * Math.cos(angle);
        const endY = startY - len * Math.sin(angle);

        ctx.strokeStyle = branchColor.replace('{hue}', `${depth * 30}`)
                                   .replace('{alpha}', `${amplitude}`);
        ctx.lineWidth = depth;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        drawBranch(endX, endY, len * 0.7, angle + amplitude, depth - 1, amplitude);
        drawBranch(endX, endY, len * 0.7, angle - amplitude, depth - 1, amplitude);
      };

      const baseAmplitude = freqDataArray[0] / 256.0;
      drawBranch(canvas.width / 2, canvas.height, branchLength, Math.PI / 2, branchDepth, baseAmplitude);
    }
  },

  fluidSpectrogram: {
    name: 'Fluid Dynamics',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        particleColor = 'hsla({hue}, 80%, 50%, {alpha})',
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        particleSize = 15,
        particleLife = 0.99,
        particleCount = 100,
        velocityScale = 2
      } = settings;

      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('fluidSpectrogram') || {};
      if (!state.particles) {
        state.particles = new Array(particleCount).fill(null).map(() => ({
          x: canvas.width / 2 + Math.cos(Math.random() * 2 * Math.PI) * 100,
          y: canvas.height / 2 + Math.sin(Math.random() * 2 * Math.PI) * 100,
          vx: (Math.random() - 0.5) * velocityScale,
          vy: (Math.random() - 0.5) * velocityScale,
          life: 1.0
        }));
        visualizerStates.set('fluidSpectrogram', state);
      }

      analyser.getByteFrequencyData(freqDataArray);
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

        ctx.fillStyle = particleColor.replace('{hue}', `${freqIndex * 360 / bufferLength}`)
                                   .replace('{alpha}', `${p.life * amplitude}`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, particleSize * p.life * (0.5 + amplitude * 0.5), 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },

  quantumSpectrogram: {
    name: 'Quantum Field',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsla({hue}, 90%, 50%, {alpha})',
        lineColor = 'rgba(255, 255, 255, {alpha})',
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        fieldSize = 20,
        probabilityThreshold = 0.5
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cols = Math.floor(canvas.width / fieldSize);
      const rows = Math.floor(canvas.height / fieldSize);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const freqIndex = Math.floor((i + j) % bufferLength);
          const amplitude = freqDataArray[freqIndex] / 256.0;
          const probability = Math.random() * amplitude;

          if (probability > probabilityThreshold) {
            const x = i * fieldSize + fieldSize / 2;
            const y = j * fieldSize + fieldSize / 2;

            ctx.fillStyle = pointColor.replace('{hue}', `${freqIndex * 360 / bufferLength}`)
                                    .replace('{alpha}', `${amplitude}`);
            ctx.beginPath();
            ctx.arc(x, y, amplitude * fieldSize * 0.5, 0, Math.PI * 2);
            ctx.fill();

            if (i > 0 && j > 0) {
              ctx.strokeStyle = lineColor.replace('{alpha}', `${amplitude * 0.2}`);
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x - fieldSize, y - fieldSize);
              ctx.stroke();
            }
          }
        }
      }
    }
  },

  blueprintSpectrogram: {
    name: 'Architectural Blueprint',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgba(0, 149, 255, {alpha})',
        fillColor = 'rgba(0, 149, 255, {alpha})',
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        margin = 50,
        amplitudeThreshold = 0.5,
        fontSize = 8
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gridSize = (canvas.width - margin * 2) / Math.sqrt(bufferLength);

      for (let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const col = i % Math.floor(Math.sqrt(bufferLength));
        const row = Math.floor(i / Math.floor(Math.sqrt(bufferLength)));

        const x = margin + col * gridSize;
        const y = margin + row * gridSize;

        ctx.strokeStyle = lineColor.replace('{alpha}', '0.5');
        ctx.beginPath();
        ctx.rect(x, y, gridSize * amplitude, gridSize * amplitude);
        ctx.stroke();

        if (amplitude > amplitudeThreshold) {
          ctx.fillStyle = fillColor.replace('{alpha}', '0.1');
          ctx.beginPath();
          ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize / 4 * amplitude, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = lineColor.replace('{alpha}', '0.5');
          ctx.beginPath();
          ctx.moveTo(x, y + gridSize + 5);
          ctx.lineTo(x + gridSize * amplitude, y + gridSize + 5);
          ctx.stroke();

          ctx.fillStyle = lineColor.replace('{alpha}', '1.0');
          ctx.font = `${fontSize}px Arial`;
          ctx.fillText(`${Math.round(amplitude * 100)}%`, x, y + gridSize + 15);
        }
      }
    }
  },

  cellularSpectrogram: {
    name: 'Biological Cell',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        membraneColor = 'rgba(255, 255, 255, {alpha})',
        organelleColor = 'hsla({hue}, 70%, 50%, {alpha})',
        connectionColor = 'rgba(255, 255, 255, {alpha})',
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        cellRadiusScale = 0.8,
        organelleSize = 20
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const cellRadius = Math.min(centerX, centerY) * cellRadiusScale;

      ctx.strokeStyle = membraneColor.replace('{alpha}', '0.2');
      ctx.beginPath();
      ctx.arc(centerX, centerY, cellRadius, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * Math.PI * 2) / bufferLength;
        const radius = cellRadius * (0.2 + amplitude * 0.6);

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        ctx.fillStyle = organelleColor.replace('{hue}', `${i * 360 / bufferLength}`)
                                    .replace('{alpha}', `${amplitude}`);
        ctx.beginPath();
        ctx.arc(x, y, amplitude * organelleSize, 0, Math.PI * 2);
        ctx.fill();

        if (i > 0) {
          ctx.strokeStyle = connectionColor.replace('{alpha}', `${amplitude * 0.3}`);
          ctx.beginPath();
          ctx.moveTo(x, y);
          const prevAngle = ((i - 1) * Math.PI * 2) / bufferLength;
          const prevX = centerX + Math.cos(prevAngle) * radius;
          const prevY = centerY + Math.sin(prevAngle) * radius;
          ctx.lineTo(prevX, prevY);
          ctx.stroke();
        }
      }
    }
  },

  sacredGeometrySpectrogram: {
    name: 'Sacred Geometry',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'hsla({hue}, 70%, 50%, {alpha})',
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        layerCount = 5,
        radiusScale = 0.8,
        amplitudeScale = 0.3
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) * radiusScale;

      for (let layer = 0; layer < layerCount; layer++) {
        const vertices = layer * 3 + 3;
        const radius = maxRadius * (1 - layer * 0.15);

        ctx.beginPath();
        for (let i = 0; i < vertices; i++) {
          const freqIndex = Math.floor(i * bufferLength / vertices);
          const amplitude = freqDataArray[freqIndex] / 256.0;
          const angle = (i * Math.PI * 2) / vertices;

          const x = centerX + Math.cos(angle) * (radius * (1 + amplitude * amplitudeScale));
          const y = centerY + Math.sin(angle) * (radius * (1 + amplitude * amplitudeScale));

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.strokeStyle = lineColor.replace('{hue}', `${layer * 72}`)
                                .replace('{alpha}', `${0.5 + layer * 0.1}`);
        ctx.stroke();

        if (layer > 0) {
          for (let i = 0; i < vertices; i++) {
            const freqIndex = Math.floor(i * bufferLength / vertices);
            const amplitude = freqDataArray[freqIndex] / 256.0;
            const angle = (i * Math.PI * 2) / vertices;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            const x = centerX + Math.cos(angle) * (radius * (1 + amplitude * amplitudeScale));
            const y = centerY + Math.sin(angle) * (radius * (1 + amplitude * amplitudeScale));
            ctx.lineTo(x, y);
            ctx.strokeStyle = lineColor.replace('{hue}', `${layer * 72}`)
                                    .replace('{alpha}', `${amplitude * 0.3}`);
            ctx.stroke();
          }
        }
      }
    }
  },

  cityscape: {
    name: 'Dynamic Cityscape',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        buildingColor = 'rgb(20, 20, {blue})',
        windowColor = 'rgba({brightness}, {brightness}, 0, 0.8)',
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        buildingCount = 40,
        baseHeightScale = 0.2,
        windowRows = 20
      } = settings;

      if (dataType !== 'frequency') return;
      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const buildingWidth = canvas.width / buildingCount;
      const baseHeight = canvas.height * baseHeightScale;

      for (let i = 0; i < buildingCount; i++) {
        const freqIndex = Math.floor((i / buildingCount) * bufferLength);
        const height = (freqDataArray[freqIndex] / 256.0) * canvas.height * 0.7;

        ctx.fillStyle = buildingColor.replace('{blue}', `${30 + height / 2}`);
        const x = i * buildingWidth;
        ctx.fillRect(x, canvas.height - height - baseHeight, buildingWidth - 2, height);

        const rows = Math.floor(height / windowRows);
        const cols = 2;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const brightness = Math.random() * 155 + 100;
            ctx.fillStyle = windowColor.replace('{brightness}', `${brightness}`);
            ctx.fillRect(
              x + col * (buildingWidth / 3) + 2,
              canvas.height - height - baseHeight + row * windowRows + 5,
              buildingWidth / 4,
              windowRows / 2
            );
          }
        }
      }
    }
  },

  neonWave: {
    name: 'Neon Wave',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = 'hsl({hue}, 100%, 50%)',
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        lineWidth = 3,
        glowIntensity = 0.5
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor.replace('{hue}', `${Date.now() % 360}`);
      ctx.shadowBlur = 10 * glowIntensity;
      ctx.shadowColor = ctx.strokeStyle as string;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  },

  matrixRain: {
    name: 'Matrix Rain',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = '#0f0',
        textColor = '#0f0',
        backgroundColor = 'rgba(0, 20, 0, 0.1)',
        lineWidth = 2,
        textInterval = 20,
        fontSize = 12
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
          if (i % textInterval === 0) {
            ctx.fillStyle = textColor;
            ctx.font = `${fontSize}px monospace`;
            ctx.fillText(String.fromCharCode(33 + Math.random() * 93), x, y);
          }
        }
        x += sliceWidth;
      }

      ctx.stroke();
    }
  },

  oceanWaves: {
    name: 'Ocean Waves',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgba(0, 150, 255, 0.8)',
        backgroundColor = 'rgba(0, 50, 100, 0.2)',
        lineWidth = 4,
        curveDepth = 10
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) ctx.moveTo(x, y);
        else {
          ctx.quadraticCurveTo(x - sliceWidth / 2, y - curveDepth, x, y);
        }
        x += sliceWidth;
      }

      ctx.stroke();
    }
  },

  fireSpectrum: {
    name: 'Fire Spectrum',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        gradientColors = [
          { stop: 0, color: '#ff0000' },
          { stop: 0.5, color: '#ff8c00' },
          { stop: 1, color: '#ffff00' }
        ],
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        lineWidth = 3,
        glowIntensity = 0.5
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradientColors.forEach(({ stop, color }: any) => gradient.addColorStop(stop, color));

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = gradient;
      ctx.shadowBlur = 10 * glowIntensity;
      ctx.shadowColor = '#ff8c00';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  },

  pixelDust: {
    name: 'Pixel Dust',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        pixelColor = 'hsl({hue}, 70%, 50%)',
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        pixelSizeScale = 8,
        pixelOpacity = 1.0
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        const pixelSize = Math.abs(v - 1) * pixelSizeScale;
        ctx.fillStyle = pixelColor.replace('{hue}', `${i / bufferLength * 360}`)
                                .replace('{alpha}', `${pixelOpacity}`);
        ctx.fillRect(x, y - pixelSize / 2, pixelSize, pixelSize);

        x += sliceWidth;
      }
    }
  },

  geometricPulse: {
    name: 'Geometric Pulse',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        shapeColor = 'hsla({hue}, 80%, 50%, {alpha})',
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        shapeInterval = 4,
        heightScale = 0.3
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerY = canvas.height / 2;
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i += shapeInterval) {
        const v = timeDataArray[i] / 128.0;
        const height = v * canvas.height * heightScale;

        ctx.beginPath();
        ctx.fillStyle = shapeColor.replace('{hue}', `${i / bufferLength * 360}`)
                                .replace('{alpha}', `${v}`);

        ctx.moveTo(x, centerY);
        ctx.lineTo(x + sliceWidth * 2, centerY - height);
        ctx.lineTo(x + sliceWidth * 4, centerY);
        ctx.lineTo(x + sliceWidth * 2, centerY + height);
        ctx.closePath();
        ctx.fill();

        x += sliceWidth * shapeInterval;
      }
    }
  },

  liquidMetal: {
    name: 'Liquid Metal',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        gradientColors = [
          { stop: 0, color: '#666' },
          { stop: 0.5, color: '#fff' },
          { stop: 1, color: '#888' }
        ],
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        lineWidth = 4,
        curveAmplitude = 20
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradientColors.forEach(({ stop, color }: any) => gradient.addColorStop(stop, color));

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = gradient;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) ctx.moveTo(x, y);
        else {
          const cp1x = x - sliceWidth / 2;
          const cp1y = y + Math.sin(Date.now() / 1000 + i / 20) * curveAmplitude;
          ctx.quadraticCurveTo(cp1x, cp1y, x, y);
        }
        x += sliceWidth;
      }

      ctx.stroke();
    }
  },

  starField: {
    name: 'Star Field',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgba(255, 255, 255, 0.8)',
        starColor = 'rgba(255, 255, 255, {alpha})',
        backgroundColor = 'rgba(0, 0, 20, 0.3)',
        lineWidth = 2,
        starInterval = 15,
        starSize = 2
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        if (i % starInterval === 0) {
          ctx.fillStyle = starColor.replace('{alpha}', `${Math.random()}`);
          ctx.fillRect(x, Math.random() * canvas.height, starSize, starSize);
        }
        x += sliceWidth;
      }

      ctx.stroke();
    }
  },

  fracturedPrism: {
    name: 'Fractured Prism',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = 'hsla({hue}, 70%, 50%, 0.6)',
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        layerCount = 3,
        displacementScale = 30,
        jitterInterval = 5,
        jitterAmplitude = 5
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerY = canvas.height / 2;
      const sliceWidth = canvas.width / bufferLength;

      for (let layer = 0; layer < layerCount; layer++) {
        let x = 0;
        ctx.beginPath();
        ctx.strokeStyle = lineColor.replace('{hue}', `${120 * layer}`);
        ctx.lineWidth = 2;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeDataArray[i] / 128.0;
          const displacement = Math.sin(i * 0.05 + layer * Math.PI / 3) * displacementScale;
          const y = centerY + v * displacement;

          if (i === 0) ctx.moveTo(x, y);
          else if (i % jitterInterval === 0) {
            ctx.lineTo(x + Math.random() * jitterAmplitude, y + Math.random() * jitterAmplitude);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
      }
    }
  },

  cosmicPulse: {
    name: 'Cosmic Pulse',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        pointColor = 'hsla({hue}, 80%, 50%, {alpha})',
        lineColor = 'hsla({hue}, 80%, 50%, 0.2)',
        backgroundColor = 'rgba(0, 0, 20, 0.2)',
        pointInterval = 8,
        pointSize = 5,
        radiusScale = 1.0
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for (let i = 0; i < bufferLength; i += pointInterval) {
        const v = timeDataArray[i] / 128.0;
        const radius = v * Math.min(centerX, centerY) * radiusScale;
        const angle = (i * 2 * Math.PI) / bufferLength;

        ctx.beginPath();
        ctx.fillStyle = pointColor.replace('{hue}', `${i / bufferLength * 360}`)
                                .replace('{alpha}', `${v * 0.5}`);

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle + 0.2) * (radius * 0.8);
        const y2 = centerY + Math.sin(angle + 0.2) * (radius * 0.8);

        ctx.arc(x1, y1, v * pointSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = lineColor.replace('{hue}', `${i / bufferLength * 360}`);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  },

  voltaicArcs: {
    name: 'Voltaic Arcs',
    draw: function (analyser, canvas, ctx, bufferLength, timeDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgba(0, {green}, {blue}, 0.8)',
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        lineWidth = 2,
        arcInterval = 10,
        arcHeightScale = 50
      } = settings;

      if (dataType !== 'time') return;
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerY = canvas.height / 2;
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor.replace('{green}', `${Math.floor(255 * (timeDataArray[0] / 128.0))}`)
                              .replace('{blue}', `${Math.floor(255 * (timeDataArray[0] / 128.0))}`);
      ctx.beginPath();

      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        let y = v * canvas.height / 2;

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
          ctx.strokeStyle = lineColor.replace('{green}', `${Math.floor(255 * v)}`)
                                   .replace('{blue}', `${Math.floor(255 * v)}`);
        }

        x += sliceWidth;
      }
      ctx.stroke();
    }
  },

  LayeredRippleVoronoi: {
    name: 'Layered Ripple Voronoi',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        rippleColor = 'hsla({hue}, 70%, 50%, 0.5)',
        pointColor = 'hsla({hue}, 80%, 50%, 0.6)',
        backgroundColor = 'rgba(0, 0, 0, 0.2)',
        pointCount = 20,
        pixelSize = 4,
        radiusScale = 0.8
      } = settings;

      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('LayeredRippleVoronoi') || {};
      if (!state.points) {
        state = {
          points: new Array(pointCount).fill(null).map((_, i) => ({
            x: 0,
            y: 0,
            color: '',
            freqIndex: Math.floor((i * 1024) / pointCount)
          })),
          numPoints: pointCount,
          pixelSize: pixelSize
        };
        visualizerStates.set('LayeredRippleVoronoi', state);
      }

      analyser.getByteFrequencyData(freqDataArray);

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
        ctx.strokeStyle = rippleColor.replace('{hue}', `${i * 360 / bufferLength}`);
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
        point.color = pointColor.replace('{hue}', `${point.freqIndex * 360 / bufferLength}`);
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
    }
  },

  waterSpectrogram: {
    name: '3D Water Spectrogram',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgba(0, 255, 255, {alpha})',
        fillColor = 'rgba(0, 255, 255, {alpha})',
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        layerCount = 15,
        connectionStep = 4,
        waveAmplitude = 20
      } = settings;

      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('waterSpectrogram') || {};
      if (!state.config) {
        state.config = {
          layers: layerCount,
          sinTable: new Float32Array(360),
          points: [],
          initialized: false
        };
        for (let i = 0; i < 360; i++) {
          state.config.sinTable![i] = Math.sin(i * Math.PI / 180);
        }
        state.config.initialized = true;
        visualizerStates.set('waterSpectrogram', state);
      }

      analyser.getByteFrequencyData(freqDataArray);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const currentTime = Date.now() / 1000;
      const points = state.config.points!;
      const layers = state.config.layers!;
      const connections = Math.floor(bufferLength / connectionStep);

      if (points.length !== layers) {
        points.length = 0;
        for (let z = 0; z < layers; z++) {
          points[z] = new Array(connections).fill(null).map(() => ({ x: 0, y: 0, z: 0, perspective: 0 }));
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
          point.y = canvas.height / 2 + (freq - 128) * 1.5 * perspective +
                    state.config!.sinTable![Math.floor((currentTime + z / 2 + i / 10) % (Math.PI * 2) * (180 / Math.PI)) % 360] * waveAmplitude;
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

          ctx.strokeStyle = lineColor.replace('{alpha}', `${current.perspective * 0.8}`);
          ctx.lineWidth = current.perspective * 2;
          ctx.moveTo(current.x, current.y);
          ctx.lineTo(next.x, next.y);
        }

        if (z > 0) {
          const previousLayer = points[z - 1];
          ctx.strokeStyle = lineColor.replace('{alpha}', `${currentLayer[0].perspective * 0.4}`);
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
      ctx.fillStyle = fillColor.replace('{alpha}', '0.1');
      ctx.fill();
    }
  },

  topwaterSpectrogram: {
    name: 'Top-Down Water Spectrogram',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType, settings = {}) {
      const {
        lineColor = 'rgba(0, 255, 255, {alpha})',
        gradientColor = 'rgba(0, 255, 255, {alpha})',
        backgroundColor = 'rgba(20, 20, 20, 0.2)',
        ringCount = 10,
        radiusScale = 0.4,
        waveAmplitude = 30,
        segmentStep = 4
      } = settings;

      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('topwaterSpectrogram') || {};
      if (!state.config) {
        state.config = {
          sinTable: new Float32Array(360),
          initialized: false
        };
        for (let i = 0; i < 360; i++) {
          state.config.sinTable![i] = Math.sin(i * Math.PI / 180);
        }
        state.config.initialized = true;
        visualizerStates.set('topwaterSpectrogram', state);
      }

      analyser.getByteFrequencyData(freqDataArray);
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

          const waveOffset = state.config!.sinTable![Math.floor((currentTime * 2 + ring + i / 5) % (Math.PI * 2) * (180 / Math.PI)) % 360] * 10;
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

        ctx.strokeStyle = lineColor.replace('{alpha}', `${alpha * 0.8}`);
        ctx.lineWidth = 2;
        ctx.stroke();

        const innerRadius = Math.max(0, ringRadius - 20);
        let outerRadius = Math.max(0, ringRadius + 20);
        if (outerRadius < innerRadius) {
          outerRadius = innerRadius;  // avoid invalid gradient params
        }
        const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
        gradient.addColorStop(0, gradientColor.replace('{alpha}', `${alpha * 0.1}`));
        gradient.addColorStop(1, gradientColor.replace('{alpha}', '0'));
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
  }

};