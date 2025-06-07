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
        lineColor = 'rgb(0, 0, 0)',
        backgroundColor = 'rgb(200, 200, 200)',
        lineWidth = 2
      } = settings;

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

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
  },

  circularSpectrogram: {
    name: 'Circular Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) - 10;

      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / bufferLength;
        const amplitude = freqDataArray[i] / 256.0;
        const x = centerX + radius * amplitude * Math.cos(angle);
        const y = centerY + radius * amplitude * Math.sin(angle);

        ctx.fillStyle = `hsl(${i * 360 / bufferLength}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  waterfall: {
    name: 'Waterfall',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);

      const imageData = ctx.getImageData(0, 1, canvas.width, canvas.height - 1);
      ctx.putImageData(imageData, 0, 0);

      for(let i = 0; i < bufferLength; i++) {
        const value = freqDataArray[i];
        ctx.fillStyle = `hsl(${value}, 100%, 50%)`;
        ctx.fillRect(i * canvas.width / bufferLength,
          canvas.height - 1,
          canvas.width / bufferLength,
          1);
      }
    }
  },

  barGraph : {
    name: 'Bar Graph',
    draw: function(analyser, canvas, ctx, bufferLength, dataArray) {
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      const barWidth = canvas.width / bufferLength;
      let x = 0;
  
      for(let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `hsl(${i * 360 / bufferLength}, 100%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth;
        dataType: 'frequency'
  }
      }
    },
    
  spiralSpectrogram: {
    name: 'Spiral Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      let radius = 10;
      
      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / 64;
        const amplitude = freqDataArray[i] / 256.0;
        radius += 0.1;
        
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        ctx.fillStyle = `hsl(${freqDataArray[i]}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(x, y, amplitude * 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  waveformSpectrum: {
    name: 'Waveform Spectrum',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      
      for(let i = 0; i < bufferLength; i++) {
        const x = i * canvas.width / bufferLength;
        const y = (freqDataArray[i] / 256.0) * canvas.height;
        ctx.lineTo(x, y);
      }
      
      ctx.strokeStyle = 'rgb(0, 255, 0)';
      ctx.stroke();
    }
  },

  rainbowSpiral: {
    name: 'Rainbow Spiral',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      for(let i = 0; i < bufferLength; i++) {
        const value = freqDataArray[i];
        const radius = (value / 256) * Math.min(centerX, centerY);
        const angle = (i * 2 * Math.PI / bufferLength) + (Date.now() / 1000);
        
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        ctx.fillStyle = `hsl(${i * 360 / bufferLength}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  pulsingOrbs: {
    name: 'Pulsing Orbs',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const numOrbs = 12;
      const spacing = canvas.width / numOrbs;
      
      for(let i = 0; i < numOrbs; i++) {
        const freqIndex = Math.floor(i * bufferLength / numOrbs);
        const value = freqDataArray[freqIndex];
        const radius = (value / 256) * spacing / 2;
        
        ctx.fillStyle = `hsl(${i * 360 / numOrbs}, 80%, 50%)`;
        ctx.beginPath();
        ctx.arc(spacing * (i + 0.5), canvas.height / 2, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  },

  frequencyMesh: {
    name: 'Frequency Mesh',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const points = [];
      const numPoints = 20;
      
      for(let i = 0; i < numPoints; i++) {
        const freqIndex = Math.floor(i * bufferLength / numPoints);
        const value = freqDataArray[freqIndex] / 256;
        points.push({
          x: (canvas.width * i) / (numPoints - 1),
          y: canvas.height / 2 + (value - 0.5) * canvas.height
        });
      }
      
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
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
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const segments = 8;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      for(let i = 0; i < bufferLength; i += 4) {
        const value = freqDataArray[i];
        const radius = (value / 256) * Math.min(centerX, centerY);
        
        for(let s = 0; s < segments; s++) {
          const angle = (s * 2 * Math.PI / segments) + (i * Math.PI / bufferLength);
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          
          ctx.fillStyle = `hsl(${i * 360 / bufferLength}, 100%, 50%)`;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  },

  voronoiSpectrum: {
    name: 'Voronoi Spectrum',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType) {
      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('voronoiSpectrum') || {};
      if (!state.points) {
        state = {
          points: new Array(20).fill(null).map((_, i) => ({
            x: 0,
            y: 0,
            color: '',
            freqIndex: Math.floor((i * 1024) / 20),
          })),
          numPoints: 20,
          pixelSize: 4,
          offscreen: document.createElement('canvas'),
          offscreenCtx: null as CanvasRenderingContext2D | null,
        };
        state.offscreen!.width = canvas.width;
        state.offscreen!.height = canvas.height;
        state.offscreenCtx = state.offscreen!.getContext('2d');
        visualizerStates.set('voronoiSpectrum', state);
      }

      analyser.getByteFrequencyData(freqDataArray);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < state.numPoints!; i++) {
        const point = state.points![i];
        point.x = Math.random() * canvas.width;
        point.y = Math.random() * canvas.height;
        const value = freqDataArray[point.freqIndex] / 256;
        point.color = `hsl(${point.freqIndex * 360 / bufferLength}, 100%, ${value * 100}%)`;
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
    },
  },

  waveformTunnel: {
    name: 'Waveform Tunnel',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY);
      
      for(let radius = maxRadius; radius > 0; radius -= 10) {
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
        ctx.strokeStyle = `hsl(${radius * 360 / maxRadius}, 100%, 50%)`;
        ctx.stroke();
      }
    }
  },

  frequencyStars: {
    name: 'Frequency Stars',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      for(let i = 0; i < bufferLength; i++) {
        const value = freqDataArray[i];
        if(value > 128) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = (value - 128) / 32;
          
          ctx.fillStyle = `hsl(${i * 360 / bufferLength}, 100%, 80%)`;
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
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) * 0.8;
      
      ctx.beginPath();
      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / bufferLength;
        const value = timeDataArray[i] / 128.0 - 1;
        const r = radius + value * 50;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `hsl(${Date.now() / 50 % 360}, 100%, 50%)`;
      ctx.stroke();
    }
  },

  spectrumRipple: {
    name: 'Spectrum Ripple',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      for(let i = 0; i < bufferLength; i += 4) {
        const value = freqDataArray[i];
        const angle = (i * 2 * Math.PI) / bufferLength;
        const radius = (value / 256) * Math.min(centerX, centerY);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `hsla(${i * 360 / bufferLength}, 100%, 50%, 0.5)`;
        ctx.stroke();
      }
    }
  },

  frequencyFlower: {
    name: 'Frequency Flower',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(centerX, centerY) * 0.3;
      
      ctx.beginPath();
      for(let i = 0; i < bufferLength; i++) {
        const angle = (i * 2 * Math.PI) / bufferLength;
        const value = freqDataArray[i] / 256;
        const radius = baseRadius + value * baseRadius * Math.sin(8 * angle);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `hsl(${Date.now() / 30 % 360}, 100%, 50%)`;
      ctx.stroke();
    }
  },
  
  spiralSpectrogramV2: {
    name: 'Spiral Spectrogram v2',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const spiralSpacing = 2;
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const angle = (i * 2 * Math.PI) / 64;
            const radius = (i / bufferLength) * Math.min(centerX, centerY) + 
                          (amplitude * 50);
            
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            ctx.fillStyle = `hsl(${i * 360 / bufferLength}, ${amplitude * 100}%, 50%)`;
            ctx.beginPath();
            ctx.arc(x, y, spiralSpacing, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
  },

  flowerSpectrogram: {
      name: 'Flower Spectrogram',
      draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
          analyser.getByteFrequencyData(freqDataArray);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const petalCount = 12;
          
          for(let i = 0; i < bufferLength; i++) {
              const amplitude = freqDataArray[i] / 256.0;
              const angle = (i * 2 * Math.PI) / bufferLength;
              const radius = Math.min(centerX, centerY) * amplitude;
              
              const petalAngle = angle * petalCount;
              const x = centerX + radius * Math.cos(petalAngle);
              const y = centerY + radius * Math.sin(petalAngle);
              
              ctx.fillStyle = `hsla(${i * 360 / bufferLength}, 80%, 50%, 0.6)`;
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, 2 * Math.PI);
              ctx.fill();
          }
      }
  },

  waveformRings: {
      name: 'Waveform Rings',
      draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
          analyser.getByteFrequencyData(freqDataArray);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const rings = 5;
          
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
              ctx.strokeStyle = `hsla(${ring * 360 / rings}, 70%, 50%, 0.5)`;
              ctx.lineWidth = 2;
              ctx.stroke();
          }
      }
  },

  particleField: {
      name: 'Particle Field',
      draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
          analyser.getByteFrequencyData(freqDataArray);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const particles = 100;
          const baseRadius = Math.min(canvas.width, canvas.height) / 4;
          
          for(let i = 0; i < particles; i++) {
              const freqIndex = Math.floor((i / particles) * bufferLength);
              const amplitude = freqDataArray[freqIndex] / 256.0;
              const angle = (i * 2 * Math.PI) / particles;
              
              const radius = baseRadius + (amplitude * 100);
              const x = canvas.width/2 + radius * Math.cos(angle);
              const y = canvas.height/2 + radius * Math.sin(angle);
              
              const size = 2 + amplitude * 5;
              
              ctx.fillStyle = `hsla(${freqIndex * 360 / bufferLength}, 
                                  ${80 + amplitude * 20}%, 
                                  ${50 + amplitude * 50}%, 
                                  ${0.3 + amplitude * 0.7})`;
              ctx.beginPath();
              ctx.arc(x, y, size, 0, 2 * Math.PI);
              ctx.fill();
          }
      }
  },

  fracturedCircle: {
      name: 'Fractured Circle',
      draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
          analyser.getByteFrequencyData(freqDataArray);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const segments = 32;
          
          for(let i = 0; i < segments; i++) {
              const freqIndex = Math.floor((i / segments) * bufferLength);
              const amplitude = freqDataArray[freqIndex] / 256.0;
              const startAngle = (i * 2 * Math.PI) / segments;
              const endAngle = ((i + 1) * 2 * Math.PI) / segments;
              
              const radius = Math.min(centerX, centerY) * (0.5 + amplitude * 0.5);
              
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, startAngle, endAngle);
              ctx.strokeStyle = `hsl(${i * 360 / segments}, 70%, 50%)`;
              ctx.lineWidth = 3 + amplitude * 5;
              ctx.stroke();
          }
      }
  },

  kaleidoscopeSpectrogram: {
    name: 'Kaleidoscope Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const mirrors = 8;
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const baseAngle = (i * 2 * Math.PI) / bufferLength;
            const radius = Math.min(centerX, centerY) * amplitude;
            
            for(let m = 0; m < mirrors; m++) {
                const angle = baseAngle + (m * 2 * Math.PI / mirrors);
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                
                ctx.fillStyle = `hsla(${i * 360 / bufferLength}, 85%, 50%, 0.5)`;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
  },

  vortexSpectrogram: {
    name: 'Vortex Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY);
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const angle = (i * 8 * Math.PI) / bufferLength;
            const radius = (i / bufferLength) * maxRadius * (1 + amplitude * 0.5);
            
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            ctx.fillStyle = `hsla(${i * 360 / bufferLength}, 90%, 
                                ${40 + amplitude * 60}%, 
                                ${0.1 + amplitude * 0.6})`;
            ctx.beginPath();
            ctx.arc(x, y, 2 + amplitude * 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
  },

  ribbonDance: {
    name: 'Ribbon Dance',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const ribbons = 3;
        const points = bufferLength / ribbons;
        
        for(let r = 0; r < ribbons; r++) {
            ctx.beginPath();
            for(let i = 0; i < points; i++) {
                const freqIndex = Math.floor(i + r * points);
                const amplitude = freqDataArray[freqIndex] / 256.0;
                
                const x = (i / points) * canvas.width;
                const y = canvas.height/2 + 
                        Math.sin(i * 0.1 + r * 2) * 100 * amplitude;
                
                if(i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.strokeStyle = `hsla(${r * 120}, 70%, 50%, 0.6)`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
  },

  constellationSpectrogram: {
    name: 'Constellation Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const points = [];
        const connections = 3;
        
        for(let i = 0; i < bufferLength; i += 2) {
            const amplitude = freqDataArray[i] / 256.0;
            const angle = (i * 2 * Math.PI) / bufferLength;
            const radius = Math.min(canvas.width, canvas.height) / 3 * 
                        (0.5 + amplitude * 0.5);
            
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
                    ctx.strokeStyle = `hsla(${i * 360 / points.length}, 70%, 50%, 
                                        ${0.15 + (p1.amplitude + p2.amplitude) * 0.2})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
            
            ctx.fillStyle = `hsla(${i * 360 / points.length}, 80%, 50%, 
                                ${0.3 + p1.amplitude * 0.7})`;
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, 2 + p1.amplitude * 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
  },

  neuroSpectrogram: {
    name: 'Neural Network Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const layers = 3;
        const nodesPerLayer = 8;
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
        
        // Draw connections
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
                    ctx.strokeStyle = `hsla(${i * 360 / nodes.length}, 70%, 50%, 
                                        ${0.1 + strength * 0.3})`;
                    ctx.lineWidth = strength * 2;
                    ctx.stroke();
                }
            }
            
            ctx.fillStyle = `hsla(${i * 360 / nodes.length}, 80%, 50%, 
                                ${0.3 + node1.amplitude * 0.7})`;
            ctx.beginPath();
            ctx.arc(node1.x, node1.y, 3 + node1.amplitude * 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
  },

  crystalSpectrogram: {
    name: 'Crystal Formation',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const branches = 6;
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const baseAngle = (i * 2 * Math.PI) / bufferLength;
            
            for(let b = 0; b < branches; b++) {
                const angle = baseAngle + (b * 2 * Math.PI / branches);
                const radius = Math.min(centerX, centerY) * 
                            (0.2 + amplitude * 0.8);
                
                const x1 = centerX + radius * Math.cos(angle);
                const y1 = centerY + radius * Math.sin(angle);
                
                // Draw main branch
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(x1, y1);
                ctx.strokeStyle = `hsla(${i * 360 / bufferLength}, 85%, 50%, 
                                      ${0.3 + amplitude * 0.7})`;
                ctx.lineWidth = 2 + amplitude * 3;
                ctx.stroke();
                
                // Draw sub-branches
                const subBranches = 3;
                for(let s = 0; s < subBranches; s++) {
                    const subAngle = angle + 
                                  (s - 1) * Math.PI / 6 * amplitude;
                    const subRadius = radius * 0.3;
                    
                    const x2 = x1 + subRadius * Math.cos(subAngle);
                    const y2 = y1 + subRadius * Math.sin(subAngle);
                    
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = `hsla(${i * 360 / bufferLength}, 85%, 50%, 
                                          ${0.2 + amplitude * 0.5})`;
                    ctx.lineWidth = 1 + amplitude * 2;
                    ctx.stroke();
                }
            }
        }
    }
  },

  fluidWaveSpectrogram: {
    name: 'Fluid Wave',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const layers = 4;
        
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
            
            const gradient = ctx.createLinearGradient(0, layerOffset - 50, 
                                                    0, layerOffset + 50);
            gradient.addColorStop(0, `hsla(${l * 90}, 70%, 50%, 0)`);
            gradient.addColorStop(0.5, `hsla(${l * 90}, 70%, 50%, 0.3)`);
            gradient.addColorStop(1, `hsla(${l * 90}, 70%, 50%, 0)`);
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
  },

  galaxySpectrogram: {
    name: 'Galaxy Formation',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const arms = 4;
        const particlesPerArm = bufferLength / arms;
        
        for(let arm = 0; arm < arms; arm++) {
            for(let i = 0; i < particlesPerArm; i++) {
                const freqIndex = Math.floor(arm * particlesPerArm + i);
                const amplitude = freqDataArray[freqIndex] / 256.0;
                
                const rotation = (i / particlesPerArm) * 2 * Math.PI + 
                              (arm * 2 * Math.PI / arms);
                const spiral = (i / particlesPerArm) * 5;
                const radius = (i / particlesPerArm) * 
                            Math.min(centerX, centerY) * 
                            (0.3 + amplitude * 0.7);
                
                const x = centerX + radius * 
                        Math.cos(rotation + spiral);
                const y = centerY + radius * 
                        Math.sin(rotation + spiral);
                
                const size = 1 + amplitude * 4;
                
                ctx.fillStyle = `hsla(${freqIndex * 360 / bufferLength}, 
                                    ${70 + amplitude * 30}%, 
                                    ${50 + amplitude * 50}%, 
                                    ${0.1 + amplitude * 0.6})`;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
  },

  dnaSpectrogram: {
    name: 'DNA Helix Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const strands = 2;
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
                const y = canvas.height/2 + 
                        Math.sin(progress * Math.PI * 2 * frequency + offset) * 
                        100 * (0.5 + amplitude * 0.5);
                
                if(i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                
                // Draw connecting bars
                if(strand === 0) {
                    const y2 = canvas.height/2 + 
                            Math.sin(progress * Math.PI * 2 * frequency + Math.PI) * 
                            100 * (0.5 + amplitude * 0.5);
                    
                    ctx.fillStyle = `hsla(${freqIndex * 360 / bufferLength}, 70%, 50%, 0.3)`;
                    ctx.fillRect(x, y, 2, y2 - y);
                }
            }
            
            ctx.strokeStyle = `hsla(${strand * 180}, 70%, 50%, 0.8)`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
  },

  galaxySpectrogramV2: {
    name: 'Galaxy Spectrogram v2',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const arms = 4;
        const particlesPerArm = bufferLength / arms;
        
        for(let arm = 0; arm < arms; arm++) {
            for(let i = 0; i < particlesPerArm; i++) {
                const freqIndex = Math.floor(arm * particlesPerArm + i);
                const amplitude = freqDataArray[freqIndex] / 256.0;
                
                const distance = (i / particlesPerArm) * Math.min(centerX, centerY);
                const rotation = arm * (2 * Math.PI / arms) + 
                              (i / particlesPerArm) * 4 * Math.PI;
                
                const x = centerX + distance * Math.cos(rotation);
                const y = centerY + distance * Math.sin(rotation);
                
                const size = 1 + amplitude * 4;
                
                ctx.fillStyle = `hsla(${freqIndex * 360 / bufferLength}, 
                                    ${70 + amplitude * 30}%, 
                                    ${50 + amplitude * 50}%, 
                                    ${0.1 + amplitude * 0.4})`;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
  },

  fractureSpectrogram: {
    name: 'Fracture Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const segments = 16;
        const layers = 4;
        
        for(let layer = 0; layer < layers; layer++) {
            const radius = (layer + 1) * Math.min(canvas.width, canvas.height) / (layers * 2);
            
            for(let i = 0; i < segments; i++) {
                const freqIndex = (layer * segments + i) % bufferLength;
                const amplitude = freqDataArray[freqIndex] / 256.0;
                
                const startAngle = (i * 2 * Math.PI / segments) + 
                                (layer * Math.PI / (layers * 2));
                const endAngle = ((i + 1) * 2 * Math.PI / segments) + 
                                (layer * Math.PI / (layers * 2));
                
                ctx.beginPath();
                ctx.arc(canvas.width/2, canvas.height/2, 
                      radius * (1 + amplitude * 0.3), 
                      startAngle, endAngle);
                
                ctx.strokeStyle = `hsla(${freqIndex * 360 / bufferLength}, 
                                      ${70 + amplitude * 30}%, 50%, 
                                      ${0.3 + amplitude * 0.7})`;
                ctx.lineWidth = 2 + amplitude * 4;
                ctx.stroke();
                
                if(amplitude > 0.5) {
                    ctx.beginPath();
                    ctx.moveTo(canvas.width/2, canvas.height/2);
                    ctx.lineTo(canvas.width/2 + radius * Math.cos(startAngle), 
                            canvas.height/2 + radius * Math.sin(startAngle));
                    ctx.strokeStyle = `hsla(${freqIndex * 360 / bufferLength}, 
                                          70%, 50%, ${amplitude - 0.5})`;
                    ctx.stroke();
                }
            }
        }
    }
  },

  weatherSpectrogram: {
    name: 'Weather Pattern Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const cloudHeight = canvas.height / 3;
        for(let i = 0; i < bufferLength; i++) {
            const x = (i * canvas.width) / bufferLength;
            const amplitude = freqDataArray[i] / 256.0;
            
            // Create cloud-like formations
            ctx.fillStyle = `rgba(255, 255, 255, ${amplitude})`;
            ctx.beginPath();
            ctx.moveTo(x, cloudHeight);
            ctx.quadraticCurveTo(
                x + 10, 
                cloudHeight - (amplitude * 100),
                x + 20, 
                cloudHeight
            );
            ctx.fill();
        }
    }
  },

  tessellationSpectrogram: {
    name: 'Tessellation Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const tileSize = 30;
        for(let i = 0; i < bufferLength; i++) {
            const x = (i % (canvas.width / tileSize)) * tileSize;
            const y = Math.floor(i / (canvas.width / tileSize)) * tileSize;
            const amplitude = freqDataArray[i] / 256.0;
            
            // Draw hexagonal tiles
            ctx.fillStyle = `hsla(${amplitude * 360}, 70%, 50%, ${amplitude})`;
            ctx.beginPath();
            for(let j = 0; j < 6; j++) {
                const angle = j * Math.PI / 3;
                const px = x + tileSize * Math.cos(angle);
                const py = y + tileSize * Math.sin(angle);
                j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
    }
  },

  organicSpectrogram: {
    name: 'Organic Growth Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        for(let i = 0; i < bufferLength; i++) {
            const angle = (i * 137.5) * Math.PI / 180; // Golden angle
            const amplitude = freqDataArray[i] / 256.0;
            const radius = amplitude * i / 2;
            
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            ctx.fillStyle = `hsla(${i * 360 / bufferLength}, 80%, 50%, ${amplitude})`;
            ctx.beginPath();
            ctx.arc(x, y, amplitude * 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
  },

  interferenceSpectrogram: {
    name: 'Wave Interference Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for(let i = 0; i < bufferLength; i++) {
            const x = (i * canvas.width) / bufferLength;
            const amplitude = freqDataArray[i] / 256.0;
            
            for(let j = 0; j < canvas.height; j += 20) {
                const wave1 = Math.sin(x / 50 + amplitude * 10) * 10;
                const wave2 = Math.cos(x / 30) * 10;
                const interference = wave1 + wave2;
                
                ctx.fillStyle = `hsla(${j + interference * 10}, 70%, 50%, ${amplitude})`;
                ctx.beginPath();
                ctx.arc(x, j + interference, 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
  },

  abstractSpectrogram: {
    name: 'Abstract Art Spectrogram',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            
            // Create abstract shapes
            ctx.fillStyle = `hsla(${i * 360 / bufferLength}, 90%, 50%, ${amplitude})`;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.bezierCurveTo(
                amplitude * canvas.width, 
                amplitude * canvas.height,
                (1 - amplitude) * canvas.width,
                (1 - amplitude) * canvas.height,
                Math.random() * canvas.width,
                Math.random() * canvas.height
            );
            ctx.fill();
        }
    }
  },

  crystalSpectrogramV2: {
    name: 'Crystalline Formation',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const angle = (i * 72) * Math.PI / 180; // Pentagon-based symmetry
            
            for(let j = 0; j < 5; j++) {
                const radius = amplitude * 200 + (j * 30);
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                
                ctx.strokeStyle = `hsla(${i * 360 / bufferLength}, 90%, 70%, ${amplitude})`;
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
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const nodes = [];
        const connections = Math.floor(bufferLength / 4);
        
        for(let i = 0; i < connections; i++) {
            const x = (canvas.width / connections) * i;
            const y = canvas.height / 2 + (freqDataArray[i] - 128) * 1.5;
            nodes.push({x, y});
            
            for(let j = 0; j < nodes.length; j++) {
                const distance = Math.hypot(nodes[j].x - x, nodes[j].y - y);
                if(distance < 100) {
                    const opacity = 1 - (distance / 100);
                    ctx.strokeStyle = `rgba(0, 255, 255, ${opacity})`;
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
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const frequency = 0.02;
        const amplitude = 100;
        
        for(let i = 0; i < bufferLength; i++) {
            const t = i * 5;
            const wave1 = Math.sin(t * frequency) * amplitude;
            const wave2 = Math.sin(t * frequency + Math.PI) * amplitude;
            
            const x1 = t + canvas.width/4;
            const y1 = canvas.height/2 + wave1;
            const x2 = t + canvas.width/4;
            const y2 = canvas.height/2 + wave2;
            
            const intensity = freqDataArray[i] / 256.0;
            
            ctx.strokeStyle = `hsla(${i}, 70%, 50%, ${intensity})`;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
  },

  nebulaSpectrogram: {
    name: 'Cosmic Nebula',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const gradient = ctx.createRadialGradient(
            canvas.width/2, canvas.height/2, 0,
            canvas.width/2, canvas.height/2, canvas.width/2
        );
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const angle = (i * Math.PI * 2) / bufferLength;
            
            const x = canvas.width/2 + Math.cos(angle) * (amplitude * 200);
            const y = canvas.height/2 + Math.sin(angle) * (amplitude * 200);
            
            ctx.fillStyle = `hsla(${270 + i}, 80%, 50%, ${amplitude * 0.1})`;
            ctx.beginPath();
            ctx.arc(x, y, amplitude * 50, 0, Math.PI * 2);
            ctx.fill();
        }
    }
  },

  circuitSpectrogram: {
    name: 'Circuit Board',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const gridSize = 20;
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const x = (i % (canvas.width / gridSize)) * gridSize;
            const y = Math.floor(i / (canvas.width / gridSize)) * gridSize;
            
            // Draw circuit paths
            ctx.strokeStyle = `rgba(0, 255, 0, ${amplitude})`;
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
            
            // Draw nodes
            ctx.fillStyle = `rgba(0, 255, 0, ${amplitude})`;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
  },

  fractalSpectrogram: {
    name: 'Fractal Tree',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType) {
      if (dataType !== 'frequency') return;

      analyser.getByteFrequencyData(freqDataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const drawBranch = (startX: number, startY: number, len: number, angle: number, depth: number, amplitude: number) => {
        if (depth === 0) return;

        const endX = startX + len * Math.cos(angle);
        const endY = startY - len * Math.sin(angle);

        ctx.strokeStyle = `hsla(${depth * 30}, 70%, 50%, ${amplitude})`;
        ctx.lineWidth = depth;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        drawBranch(endX, endY, len * 0.7, angle + amplitude, depth - 1, amplitude);
        drawBranch(endX, endY, len * 0.7, angle - amplitude, depth - 1, amplitude);
      };

      const baseAmplitude = freqDataArray[0] / 256.0;
      drawBranch(canvas.width / 2, canvas.height, 100, Math.PI / 2, 9, baseAmplitude);
    },
  },

  fluidSpectrogram: {
    name: 'Fluid Dynamics',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType) {
      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('fluidSpectrogram') || {};
      if (!state.particles) {
        state.particles = [];
        visualizerStates.set('fluidSpectrogram', state);
      }

      analyser.getByteFrequencyData(freqDataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Add new particles
      for (let i = 0; i < bufferLength; i++) {
        const amplitude = freqDataArray[i] / 256.0;
        const angle = (i * Math.PI * 2) / bufferLength;

        state.particles!.push({
          x: canvas.width / 2 + Math.cos(angle) * (100 + amplitude * 100),
          y: canvas.height / 2 + Math.sin(angle) * (100 + amplitude * 100),
          vx: amplitude * Math.cos(angle) * 5,
          vy: amplitude * Math.sin(angle) * 5,
          life: 1.0,
        });
      }

      // Draw and update particles
      state.particles!.forEach((p, index) => {
        ctx.fillStyle = `hsla(${index * 360 / bufferLength}, 80%, 50%, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (freqDataArray[index % bufferLength] / 256.0) * 15, 0, Math.PI * 2);
        ctx.fill();

        // Update particle position
        p.x += p.vx;
        p.y += p.vy;
        p.life *= 0.99;
      });

      // Remove dead particles
      state.particles = state.particles!.filter(p => p.life > 0.01);
    },
  },

  quantumSpectrogram: {
    name: 'Quantum Field',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const fieldSize = 20;
        const cols = canvas.width / fieldSize;
        const rows = canvas.height / fieldSize;
        
        for(let i = 0; i < cols; i++) {
            for(let j = 0; j < rows; j++) {
                const freqIndex = Math.floor((i + j) % bufferLength);
                const amplitude = freqDataArray[freqIndex] / 256.0;
                
                const probability = Math.random() * amplitude;
                if(probability > 0.5) {
                    const x = i * fieldSize;
                    const y = j * fieldSize;
                    
                    ctx.fillStyle = `hsla(${freqIndex * 360 / bufferLength}, 90%, 50%, ${amplitude})`;
                    ctx.beginPath();
                    ctx.arc(x, y, amplitude * 10, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Quantum entanglement lines
                    if(i > 0 && j > 0) {
                        ctx.strokeStyle = `rgba(255, 255, 255, ${amplitude * 0.2})`;
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
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(0, 149, 255, 0.5)';
        ctx.fillStyle = 'rgba(0, 149, 255, 0.1)';
        
        const margin = 50;
        const gridSize = (canvas.width - margin * 2) / Math.sqrt(bufferLength);
        
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const col = i % Math.floor(Math.sqrt(bufferLength));
            const row = Math.floor(i / Math.floor(Math.sqrt(bufferLength)));
            
            const x = margin + col * gridSize;
            const y = margin + row * gridSize;
            
            // Draw architectural elements
            ctx.beginPath();
            ctx.rect(x, y, gridSize * amplitude, gridSize * amplitude);
            ctx.stroke();
            
            if(amplitude > 0.5) {
                ctx.beginPath();
                ctx.arc(x + gridSize/2, y + gridSize/2, gridSize/4 * amplitude, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Add measurement lines
                ctx.beginPath();
                ctx.moveTo(x, y + gridSize + 5);
                ctx.lineTo(x + gridSize * amplitude, y + gridSize + 5);
                ctx.stroke();
                
                ctx.font = '8px Arial';
                ctx.fillText(`${Math.round(amplitude * 100)}%`, x, y + gridSize + 15);
            }
        }
    }
  },

  cellularSpectrogram: {
    name: 'Biological Cell',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const cellRadius = Math.min(centerX, centerY) * 0.8;
        
        // Draw cell membrane
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, cellRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw organelles
        for(let i = 0; i < bufferLength; i++) {
            const amplitude = freqDataArray[i] / 256.0;
            const angle = (i * Math.PI * 2) / bufferLength;
            const radius = cellRadius * (0.2 + amplitude * 0.6);
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            ctx.fillStyle = `hsla(${i * 360 / bufferLength}, 70%, 50%, ${amplitude})`;
            
            // Draw organelle
            ctx.beginPath();
            ctx.arc(x, y, amplitude * 20, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw cellular connections
            if(i > 0) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${amplitude * 0.3})`;
                ctx.beginPath();
                ctx.moveTo(x, y);
                const prevAngle = ((i-1) * Math.PI * 2) / bufferLength;
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
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
        analyser.getByteFrequencyData(freqDataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY) * 0.8;
        
        // Draw multiple geometric layers
        for(let layer = 0; layer < 5; layer++) {
            const vertices = layer * 3 + 3; // 3,6,9,12,15 vertices
            const radius = maxRadius * (1 - layer * 0.15);
            
            ctx.beginPath();
            for(let i = 0; i < vertices; i++) {
                const freqIndex = Math.floor(i * bufferLength / vertices);
                const amplitude = freqDataArray[freqIndex] / 256.0;
                const angle = (i * Math.PI * 2) / vertices;
                
                const x = centerX + Math.cos(angle) * (radius * (1 + amplitude * 0.3));
                const y = centerY + Math.sin(angle) * (radius * (1 + amplitude * 0.3));
                
                if(i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.strokeStyle = `hsla(${layer * 72}, 70%, 50%, ${0.5 + layer * 0.1})`;
            ctx.stroke();
            
            // Add inner connections
            if(layer > 0) {
                for(let i = 0; i < vertices; i++) {
                    const freqIndex = Math.floor(i * bufferLength / vertices);
                    const amplitude = freqDataArray[freqIndex] / 256.0;
                    const angle = (i * Math.PI * 2) / vertices;
                    
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    const x = centerX + Math.cos(angle) * (radius * (1 + amplitude * 0.3));
                    const y = centerY + Math.sin(angle) * (radius * (1 + amplitude * 0.3));
                    ctx.lineTo(x, y);
                    ctx.strokeStyle = `hsla(${layer * 72}, 70%, 50%, ${amplitude * 0.3})`;
                    ctx.stroke();
                }
            }
        }
    }
  },

  cityscape: {
    name: 'Dynamic Cityscape',
    draw: function(analyser, canvas, ctx, bufferLength, freqDataArray) {
      analyser.getByteFrequencyData(freqDataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const buildingWidth = canvas.width / 40;
      const baseHeight = canvas.height * 0.2;
      
      for(let i = 0; i < 40; i++) {
        const freqIndex = Math.floor((i / 40) * bufferLength);
        const height = (freqDataArray[freqIndex] / 256.0) * canvas.height * 0.7;
        
        // Main building
        ctx.fillStyle = `rgb(20, 20, ${30 + height/2})`;
        const x = i * buildingWidth;
        ctx.fillRect(x, canvas.height - height - baseHeight, buildingWidth - 2, height);
        
        // Windows
        const windowRows = Math.floor(height / 20);
        const windowCols = 2;
        for(let row = 0; row < windowRows; row++) {
          for(let col = 0; col < windowCols; col++) {
            const brightness = Math.random() * 155 + 100;
            ctx.fillStyle = `rgba(${brightness}, ${brightness}, 0, 0.8)`;
            ctx.fillRect(
              x + col * (buildingWidth/3) + 2,
              canvas.height - height - baseHeight + row * 20 + 5,
              buildingWidth/4,
              10
            );
          }
        }
      }
    }
  },

  neonWave: {
    name: 'Neon Wave',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = `hsl(${Date.now() % 360}, 100%, 50%)`;
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height/2;
        
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      
      ctx.stroke();
    }
  },

  matrixRain: {
    name: 'Matrix Rain',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 20, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0f0';
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height/2;
        
        if(i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
          if (i % 20 === 0) {
            ctx.fillStyle = '#0f0';
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
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 50, 100, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height/2;
        
        if(i === 0) ctx.moveTo(x, y);
        else {
          ctx.quadraticCurveTo(x - sliceWidth/2, y - 10, x, y);
        }
        x += sliceWidth;
      }
      
      ctx.stroke();
    }
  },

  fireSpectrum: {
    name: 'Fire Spectrum',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#ff0000');
      gradient.addColorStop(0.5, '#ff8c00');
      gradient.addColorStop(1, '#ffff00');
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height/2;
        
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      
      ctx.stroke();
    }
  },

  pixelDust: {
    name: 'Pixel Dust',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height/2;
        
        const pixelSize = Math.abs(v - 1) * 8;
        ctx.fillStyle = `hsl(${i / bufferLength * 360}, 70%, 50%)`;
        ctx.fillRect(x, y - pixelSize/2, pixelSize, pixelSize);
        
        x += sliceWidth;
      }
    }
  },

  geometricPulse: {
    name: 'Geometric Pulse',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerY = canvas.height / 2;
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i += 4) {
        const v = timeDataArray[i] / 128.0;
        const height = v * canvas.height/3;
        
        ctx.beginPath();
        ctx.fillStyle = `hsla(${i / bufferLength * 360}, 80%, 50%, ${v})`;
        
        // Draw diamond shape
        ctx.moveTo(x, centerY);
        ctx.lineTo(x + sliceWidth * 2, centerY - height);
        ctx.lineTo(x + sliceWidth * 4, centerY);
        ctx.lineTo(x + sliceWidth * 2, centerY + height);
        ctx.closePath();
        ctx.fill();
        
        x += sliceWidth * 4;
      }
    }
  },

  liquidMetal: {
    name: 'Liquid Metal',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(20, 20, 20, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#666');
      gradient.addColorStop(0.5, '#fff');
      gradient.addColorStop(1, '#888');
      
      ctx.lineWidth = 4;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height/2;
        
        if(i === 0) ctx.moveTo(x, y);
        else {
          const cp1x = x - sliceWidth/2;
          const cp1y = y + Math.sin(Date.now()/1000 + i/20) * 20;
          ctx.quadraticCurveTo(cp1x, cp1y, x, y);
        }
        x += sliceWidth;
      }
      
      ctx.stroke();
    }
  },

  starField: {
    name: 'Star Field',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 20, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        const y = v * canvas.height/2;
        
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        
        if(i % 15 === 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.random()})`;
          ctx.fillRect(x, Math.random() * canvas.height, 2, 2);
        }
        x += sliceWidth;
      }
      
      ctx.stroke();
    }
  },

  fracturedPrism: {
    name: 'Fractured Prism',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerY = canvas.height / 2;
      const sliceWidth = canvas.width / bufferLength;
      
      for(let layer = 0; layer < 3; layer++) {
        let x = 0;
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${120 * layer}, 70%, 50%, 0.6)`;
        ctx.lineWidth = 2;
        
        for(let i = 0; i < bufferLength; i++) {
          const v = timeDataArray[i] / 128.0;
          const displacement = Math.sin(i * 0.05 + layer * Math.PI/3) * 30;
          const y = centerY + v * displacement;
          
          if(i === 0) ctx.moveTo(x, y);
          else if(i % 5 === 0) {
            ctx.lineTo(x + Math.random() * 5, y + Math.random() * 5);
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
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 20, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      for(let i = 0; i < bufferLength; i += 8) {
        const v = timeDataArray[i] / 128.0;
        const radius = v * Math.min(centerX, centerY);
        const angle = (i * 2 * Math.PI) / bufferLength;
        
        ctx.beginPath();
        ctx.fillStyle = `hsla(${i / bufferLength * 360}, 80%, 50%, ${v * 0.5})`;
        
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle + 0.2) * (radius * 0.8);
        const y2 = centerY + Math.sin(angle + 0.2) * (radius * 0.8);
        
        ctx.arc(x1, y1, v * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${i / bufferLength * 360}, 80%, 50%, 0.2)`;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  },

  voltaicArcs: {
    name: 'Voltaic Arcs',
    draw: function(analyser, canvas, ctx, bufferLength, timeDataArray) {
      analyser.getByteTimeDomainData(timeDataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerY = canvas.height / 2;
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ffff';
      ctx.beginPath();
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0;
        let y = v * canvas.height/2;
        
        if(i % 10 === 0) {
          const arcHeight = Math.random() * 50 * v;
          ctx.lineTo(x, y);
          ctx.lineTo(x + 5, y - arcHeight);
          ctx.lineTo(x + 10, y);
        } else {
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        
        if(i % 20 === 0) {
          ctx.strokeStyle = `rgba(0, ${Math.floor(255 * v)}, ${Math.floor(255 * v)}, 0.8)`;
        }
        
        x += sliceWidth;
      }
      ctx.stroke();
    }
  },

  LayeredRippleVoronoi: {
    name: 'Layered Ripple Voronoi',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType) {
      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('LayeredRippleVoronoi') || {};
      if (!state.points) {
        state = {
          points: new Array(20).fill(null).map((_, i) => ({
            x: 0,
            y: 0,
            color: '',
            freqIndex: Math.floor((i * 1024) / 20),
          })),
          numPoints: 20,
          pixelSize: 4,
        };
        visualizerStates.set('LayeredRippleVoronoi', state);
      }

      analyser.getByteFrequencyData(freqDataArray);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw ripple effect
      for (let i = 0; i < bufferLength; i += 4) {
        const value = freqDataArray[i];
        const angle = (i * 2 * Math.PI) / bufferLength;
        const radius = (value / 256) * Math.min(centerX, centerY) * 0.8;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `hsla(${i * 360 / bufferLength}, 70%, 50%, 0.5)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Update Voronoi points
      for (let i = 0; i < state.numPoints!; i++) {
        const point = state.points![i];
        const value = freqDataArray[point.freqIndex];
        const angle = (i * 2 * Math.PI) / state.numPoints!;
        const radius = (value / 256) * Math.min(centerX, centerY) * 0.6;

        point.x = centerX + Math.cos(angle) * radius;
        point.y = centerY + Math.sin(angle) * radius;
        point.color = `hsla(${point.freqIndex * 360 / bufferLength}, 80%, 50%, 0.6)`;
      }

      // Draw Voronoi cells
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
  },

  waterSpectrogram: {
    name: '3D Water Spectrogram',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType) {
      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('waterSpectrogram') || {};
      if (!state.config) {
        state.config = {
          layers: 15,
          sinTable: new Float32Array(360),
          points: [],
          initialized: false,
        };
        for (let i = 0; i < 360; i++) {
          state.config.sinTable![i] = Math.sin(i * Math.PI / 180);
        }
        state.config.initialized = true;
        visualizerStates.set('waterSpectrogram', state);
      }

      analyser.getByteFrequencyData(freqDataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentTime = Date.now() / 1000;
      const points = state.config.points!;
      const layers = state.config.layers!;
      const connections = Math.floor(bufferLength / 6);

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
          const freq = freqDataArray[i * 4] * perspective;
          const point = layerPoints[i];
          point.x = widthStep * i;
          point.y = canvas.height / 2 + (freq - 128) * 1.5 * perspective + state.config!.sinTable![Math.floor((currentTime + z / 2 + i / 10) % (Math.PI * 2) * (180 / Math.PI)) % 360] * 20;
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

          ctx.strokeStyle = `rgba(0, 255, 255, ${current.perspective * 0.8})`;
          ctx.lineWidth = current.perspective * 2;
          ctx.moveTo(current.x, current.y);
          ctx.lineTo(next.x, next.y);
        }

        if (z > 0) {
          const previousLayer = points[z - 1];
          ctx.strokeStyle = `rgba(0, 255, 255, ${currentLayer[0].perspective * 0.4})`;
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
      ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
      ctx.fill();
    },
  },

  topwaterSpectrogram: {
    name: 'Top-Down Water Spectrogram',
    draw: function (analyser, canvas, ctx, bufferLength, freqDataArray, dataType) {
      if (dataType !== 'frequency') return;
      let state = visualizerStates.get('topwaterSpectrogram') || {};
      if (!state.config) {
        state.config = {
          sinTable: new Float32Array(360),
          initialized: false,
        };
        for (let i = 0; i < 360; i++) {
          state.config.sinTable![i] = Math.sin(i * Math.PI / 180);
        }
        state.config.initialized = true;
        visualizerStates.set('topwaterSpectrogram', state);
      }

      analyser.getByteFrequencyData(freqDataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentTime = Date.now() / 1000;
      const radius = Math.min(canvas.width, canvas.height) * 0.4;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const segments = Math.floor(bufferLength / 4);

      for (let ring = 0; ring < 10; ring++) {
        const ringRadius = radius - ring * 20;
        const alpha = 1 - ring * 0.1;

        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const freqIndex = i % bufferLength;
          const frequency = freqDataArray[freqIndex];

          const waveOffset = state.config!.sinTable![Math.floor((currentTime * 2 + ring + i / 5) % (Math.PI * 2) * (180 / Math.PI)) % 360] * 10;
          const radiusOffset = (frequency / 255) * 30 + waveOffset;
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

        ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        const gradient = ctx.createRadialGradient(centerX, centerY, ringRadius - 20, centerX, centerY, ringRadius + 20);
        gradient.addColorStop(0, `rgba(0, 255, 255, ${alpha * 0.1})`);
        gradient.addColorStop(1, `rgba(0, 255, 255, 0)`);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    },
  },
};