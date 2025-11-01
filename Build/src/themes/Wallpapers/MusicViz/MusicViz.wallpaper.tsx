import React, { useRef, useEffect } from 'react';

const MusicViz: React.FC<WallpaperProps> = ({ playbackState }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    let analyser = playbackState?.analyserNode || null;
    let dataArray: Uint8Array | null = null;
    if (analyser) {
      const len = analyser.frequencyBinCount;
      dataArray = new Uint8Array(len);
    }

    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (analyser && dataArray) {
  (analyser as any).getByteFrequencyData(dataArray);
        const barWidth = canvas.width / dataArray.length;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 255;
          const h = v * canvas.height;
          ctx.fillStyle = `hsl(${i / dataArray.length * 360}, 80%, ${30 + v * 50}%)`;
          ctx.fillRect(i * barWidth, canvas.height - h, Math.ceil(barWidth), h);
        }
      } else {
        // fallback animation: pulsating circle when playing
        const t = Date.now() / 300;
        const r = 30 + (playbackState?.isPlaying ? (Math.sin(t) + 1) * 40 : 10);
        ctx.beginPath();
        ctx.fillStyle = '#6ee7b7';
        ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [playbackState]);

  return (
    <canvas ref={canvasRef} style={{ background: 'navy', position: 'fixed', inset: 0, zIndex: -1, width: '100%', height: '100%'}} />
  );
};

export default MusicViz;
