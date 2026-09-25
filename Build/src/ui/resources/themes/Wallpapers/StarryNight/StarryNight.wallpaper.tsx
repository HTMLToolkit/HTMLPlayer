import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

const StarryNightWallpaper: React.FC<WallpaperProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const timeRef = useRef(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const createStar = (width: number, height: number): Star => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 2 + 0.5,
    brightness: Math.random() * 0.8 + 0.2,
    twinkleSpeed: Math.random() * 0.02 + 0.01,
    twinkleOffset: Math.random() * Math.PI * 2,
  });

  const updateDimensions = () => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  useEffect(() => {
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const starCount = Math.min(
      200,
      Math.floor((dimensions.width * dimensions.height) / 8000),
    );
    starsRef.current = Array.from({ length: starCount }, () =>
      createStar(dimensions.width, dimensions.height),
    );

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tickerId = gsap.ticker.add(() => {
      timeRef.current += 0.02 * gsap.ticker.deltaRatio(60);

      const gradient = ctx.createRadialGradient(
        dimensions.width / 2,
        dimensions.height / 2,
        0,
        dimensions.width / 2,
        dimensions.height / 2,
        Math.max(dimensions.width, dimensions.height) / 2,
      );

      gradient.addColorStop(0, "#0f0f23");
      gradient.addColorStop(0.5, "#1a1a2e");
      gradient.addColorStop(1, "#16213e");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      starsRef.current.forEach((star) => {
        const twinkle =
          Math.sin(timeRef.current * star.twinkleSpeed + star.twinkleOffset) *
            0.5 +
          0.5;
        const currentBrightness = star.brightness * (0.3 + twinkle * 0.7);

        ctx.globalAlpha = currentBrightness;
        ctx.fillStyle = "#ffffff";

        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = star.size * 3;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
      });

      ctx.globalAlpha = 1;

      if (Math.random() < 0.005 * gsap.ticker.deltaRatio(60)) {
        const startX = Math.random() * dimensions.width;
        const startY = Math.random() * dimensions.height * 0.3;
        const endX = startX + 200;
        const endY = startY + 100;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.shadowBlur = 0;
      }
    });

    return () => {
      gsap.ticker.remove(tickerId);
    };
  }, [dimensions]);

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

export default StarryNightWallpaper;
