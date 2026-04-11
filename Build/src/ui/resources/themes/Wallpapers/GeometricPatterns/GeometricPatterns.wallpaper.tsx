import React, { useEffect, useRef } from "react";

const GeometricPatternsWallpaper: React.FC<WallpaperProps> = () => {
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

    const drawHexagon = (
      x: number,
      y: number,
      size: number,
      rotation: number,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = size * Math.cos(angle);
        const hy = size * Math.sin(angle);

        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    const drawTriangle = (
      x: number,
      y: number,
      size: number,
      rotation: number,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(-size * 0.866, size * 0.5);
      ctx.lineTo(size * 0.866, size * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    const drawCircle = (x: number, y: number, radius: number) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    };

    const animate = () => {
      timeRef.current += 0.02;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Set up stroke style
      ctx.strokeStyle = `hsl(${(timeRef.current * 10) % 360}, 70%, 60%)`;
      ctx.lineWidth = 2;

      const gridSize = 80;
      const rows = Math.ceil(canvas.height / gridSize) + 1;
      const cols = Math.ceil(canvas.width / gridSize) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * gridSize;
          const y = row * gridSize;

          const offsetX =
            Math.sin(timeRef.current + row * 0.5 + col * 0.3) * 20;
          const offsetY =
            Math.cos(timeRef.current + row * 0.3 + col * 0.5) * 20;

          const centerX = x + offsetX;
          const centerY = y + offsetY;

          const shapeType = (row + col) % 3;
          const rotation = timeRef.current + row * 0.2 + col * 0.1;
          const size = 25 + Math.sin(timeRef.current * 2 + row + col) * 10;

          switch (shapeType) {
            case 0:
              drawHexagon(centerX, centerY, size, rotation);
              break;
            case 1:
              drawTriangle(centerX, centerY, size, rotation);
              break;
            case 2:
              drawCircle(centerX, centerY, size);
              break;
          }
        }
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
        background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f0f23)",
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

export default GeometricPatternsWallpaper;
