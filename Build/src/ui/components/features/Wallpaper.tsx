import React, { Suspense, useEffect, useRef } from "react";
import { useWallpaper, useTheming } from "../../theming/hooks/useTheming";

// WallpaperRenderer Component
interface WallpaperRendererProps {
  currentSong: any;
  playbackState: any;
}

const WallpaperRenderer: React.FC<WallpaperRendererProps> = ({
  currentSong,
  playbackState,
}) => {
  const { currentWallpaper, getWallpaperComponent } = useWallpaper();
  const { isLoading } = useTheming();
  const wallpaperKeyRef = useRef(0);

  useEffect(() => {
    wallpaperKeyRef.current += 1;
  }, [currentWallpaper?.name, currentWallpaper]);

  if (isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "#000",
          zIndex: -1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        Loading wallpaper...
      </div>
    );
  }

  if (!getWallpaperComponent) {
    // No wallpaper selected - use theme gradient background
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "var(--themegradient)",
          zIndex: -1,
        }}
      />
    );
  }

  const wallpaperComponent = getWallpaperComponent?.() as
    | React.ComponentType<{ currentSong?: unknown; playbackState?: unknown }>
    | null
    | undefined;

  if (!wallpaperComponent) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "var(--themegradient)",
          zIndex: -1,
        }}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "#000",
            zIndex: -1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
          }}
        >
          Loading wallpaper component...
        </div>
      }
    >
      {wallpaperComponent &&
        React.createElement(wallpaperComponent, {
          key: `wallpaper-${wallpaperKeyRef.current}`,
          currentSong,
          playbackState,
        })}
    </Suspense>
  );
};

export default WallpaperRenderer;
