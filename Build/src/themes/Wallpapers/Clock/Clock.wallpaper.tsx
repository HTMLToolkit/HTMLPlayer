import React, { useEffect, useState } from "react";

const pad = (n: number) => n.toString().padStart(2, "0");

const AnalogClock: React.FC<{ now: Date }> = ({ now }) => {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  return (
    <div style={{ position: "relative", width: 300, height: 300 }}>
      {/* Clock face */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.9)",
          border: "4px solid #333",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      />

      {/* Hour markers */}
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 4,
            height: 20,
            background: "#333",
            left: "50%",
            top: 10,
            transformOrigin: "2px 140px",
            transform: `translateX(-50%) rotate(${i * 30}deg)`,
          }}
        />
      ))}

      {/* Minute markers */}
      {Array.from({ length: 60 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 2,
            height: 10,
            background: "#666",
            left: "50%",
            top: 5,
            transformOrigin: "1px 145px",
            transform: `translateX(-50%) rotate(${i * 6}deg)`,
          }}
        />
      ))}

      {/* Hour hand */}
      <div
        style={{
          position: "absolute",
          width: 6,
          height: 80,
          background: "#333",
          left: "50%",
          bottom: "50%",
          transformOrigin: "3px 80px",
          transform: `translateX(-50%) rotate(${(hours + minutes / 60) * 30}deg)`,
          borderRadius: "3px",
        }}
      />

      {/* Minute hand */}
      <div
        style={{
          position: "absolute",
          width: 4,
          height: 120,
          background: "#555",
          left: "50%",
          bottom: "50%",
          transformOrigin: "2px 120px",
          transform: `translateX(-50%) rotate(${(minutes + seconds / 60) * 6}deg)`,
          borderRadius: "2px",
        }}
      />

      {/* Second hand */}
      <div
        style={{
          position: "absolute",
          width: 2,
          height: 130,
          background: "#e74c3c",
          left: "50%",
          bottom: "50%",
          transformOrigin: "1px 130px",
          transform: `translateX(-50%) rotate(${seconds * 6}deg)`,
          borderRadius: "1px",
        }}
      />

      {/* Center dot */}
      <div
        style={{
          position: "absolute",
          width: 12,
          height: 12,
          background: "#333",
          borderRadius: "50%",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
};

const DigitalClock: React.FC<{ now: Date }> = ({ now }) => (
  <div style={{ textAlign: "center" }}>
    <div
      style={{ fontSize: "6rem", fontFamily: "monospace", fontWeight: "bold" }}
    >
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </div>
    <div style={{ marginTop: 8, opacity: 0.8, fontSize: "1.2rem" }}>
      {now.toLocaleDateString()}
    </div>
  </div>
);

const ClockWallpaper: React.FC<WallpaperProps> = () => {
  const [now, setNow] = useState(new Date());
  const [isAnalog, setIsAnalog] = useState(() => {
    const stored = localStorage.getItem("clock-mode");
    return stored ? stored === "analog" : false; // Default to digital
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleClockMode = () => {
    const newMode = !isAnalog;
    setIsAnalog(newMode);
    localStorage.setItem("clock-mode", newMode ? "analog" : "digital");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#f5f7fa,#c3dafe)",
        zIndex: -1,
        color: "#222",
        cursor: "pointer",
      }}
      onClick={toggleClockMode}
      title={`Click to switch to ${isAnalog ? "digital" : "analog"} clock`}
    >
      {isAnalog ? <AnalogClock now={now} /> : <DigitalClock now={now} />}
    </div>
  );
};

export default ClockWallpaper;
