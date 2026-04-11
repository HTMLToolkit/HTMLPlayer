import React, { useEffect, useRef } from "react";

const GradientWavesWallpaper: React.FC<WallpaperProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const animate = () => {
      timeRef.current += 0.01;

      // Create gradient
      const gradient = ctx.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // Dynamic color stops based on time
      const colors = [
        `hsl(${(timeRef.current * 20) % 360}, 70%, 60%)`,
        `hsl(${(timeRef.current * 20 + 60) % 360}, 70%, 50%)`,
        `hsl(${(timeRef.current * 20 + 120) % 360}, 70%, 40%)`,
        `hsl(${(timeRef.current * 20 + 180) % 360}, 70%, 30%)`,
      ];

      colors.forEach((color, index) => {
        gradient.addColorStop(index / (colors.length - 1), color);
      });

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add wave overlays
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        for (let x = 0; x <= canvas.width; x += 2) {
          const y =
            canvas.height / 2 +
            Math.sin(x * 0.01 + timeRef.current + i) * 50 +
            Math.sin(x * 0.005 + timeRef.current * 0.5 + i) * 30;

          ctx.lineTo(x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        const waveGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        waveGradient.addColorStop(0, `rgba(255, 255, 255, ${0.1 + i * 0.05})`);
        waveGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = waveGradient;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
};

export default GradientWavesWallpaper;
