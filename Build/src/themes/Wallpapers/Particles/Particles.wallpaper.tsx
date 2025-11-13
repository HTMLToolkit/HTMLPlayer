import React, { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

const ParticlesWallpaper: React.FC<WallpaperProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const colors = [
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96ceb4",
    "#ffeaa7",
    "#dda0dd",
    "#98d8c8",
    "#f7dc6f",
    "#bb8fce",
    "#85c1e9",
  ];

  const createParticle = (width: number, height: number): Particle => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: Math.random() * 3 + 1,
    opacity: Math.random() * 0.8 + 0.2,
    color: colors[Math.floor(Math.random() * colors.length)],
  });

  const updateParticles = (width: number, height: number) => {
    particlesRef.current.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Wrap around edges
      if (particle.x < 0) particle.x = width;
      if (particle.x > width) particle.x = 0;
      if (particle.y < 0) particle.y = height;
      if (particle.y > height) particle.y = 0;

      // Subtle opacity pulsing
      particle.opacity += (Math.random() - 0.5) * 0.01;
      particle.opacity = Math.max(0.1, Math.min(1, particle.opacity));
    });
  };

  const drawParticles = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    ctx.clearRect(0, 0, width, height);

    // Draw connections between nearby particles
    particlesRef.current.forEach((particle, i) => {
      particlesRef.current.slice(i + 1).forEach((otherParticle) => {
        const dx = particle.x - otherParticle.x;
        const dy = particle.y - otherParticle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 100) {
          const opacity = (1 - distance / 100) * 0.3;
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(otherParticle.x, otherParticle.y);
          ctx.stroke();
        }
      });
    });

    // Draw particles
    particlesRef.current.forEach((particle) => {
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Add glow effect
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = particle.size * 2;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.globalAlpha = 1;
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    updateParticles(canvas.width, canvas.height);
    drawParticles(ctx, canvas.width, canvas.height);

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Initialize particles
    const particleCount = Math.min(
      150,
      Math.floor((dimensions.width * dimensions.height) / 10000),
    );
    particlesRef.current = Array.from({ length: particleCount }, () =>
      createParticle(dimensions.width, dimensions.height),
    );

    // Start animation
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        background: "linear-gradient(135deg, #0f0f23, #1a1a2e, #16213e)",
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

export default ParticlesWallpaper;
