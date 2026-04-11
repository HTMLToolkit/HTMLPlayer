import React from "react";

// Types for wallpaper props (API exposure)
export interface WallpaperProps {
  currentSong?: {
    title: string;
    artist: string;
    album: string;
    duration: number;
    currentTime: number;
  };
  playbackState?: {
    isPlaying: boolean;
    volume: number;
    isMuted: boolean;
  };
}

// Static Background Wallpaper Component
const StaticBackground: React.FC<WallpaperProps> = ({
  currentSong,
  playbackState,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #0caddeff 0%, #09e8adff 100%)",
        zIndex: -1, // Behind everything
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: "2rem",
        textAlign: "center",
        opacity: playbackState?.isPlaying ? 1 : 0.7,
        transition: "opacity 0.3s ease",
      }}
    >
      {currentSong ? (
        <div>
          <h1>{currentSong.title}</h1>
          <p>
            {currentSong.artist} - {currentSong.album}
          </p>
        </div>
      ) : (
        <h1>HTMLPlayer</h1>
      )}
    </div>
  );
};

export default StaticBackground;
