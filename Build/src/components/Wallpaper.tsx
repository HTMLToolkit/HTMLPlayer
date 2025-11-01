import React, { Suspense, useEffect, useRef } from 'react';
import { useWallpaperLoader } from '../helpers/wallpaperLoader';

// WallpaperRenderer Component
interface WallpaperRendererProps {
  currentSong: any; // TODO: Use proper Song type
  playbackState: any; // TODO: Use proper PlayerState type
}

const WallpaperRenderer: React.FC<WallpaperRendererProps> = ({ currentSong, playbackState }) => {
  const { currentWallpaper, currentWallpaperComponent, isLoading, error } = useWallpaperLoader();
  const wallpaperKeyRef = useRef(0);

  // Increment key when wallpaper changes to force re-mount
  useEffect(() => {
    wallpaperKeyRef.current += 1;
  }, [currentWallpaper?.name, currentWallpaperComponent]);

  if (isLoading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#000',
        zIndex: -1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        Loading wallpaper...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#f00',
        zIndex: -1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        Wallpaper Error: {error}
      </div>
    );
  }

  if (!currentWallpaperComponent) {
    // No wallpaper selected - use theme gradient background
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'var(--themegradient)',
        zIndex: -1
      }} />
    );
  }

  // Create wallpaper props from the passed data
  const wallpaperProps = {
    currentSong,
    playbackState
  };

  // Create a component from the loaded component
  const WallpaperComponent = currentWallpaperComponent;

  return (
    <Suspense fallback={
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#000',
        zIndex: -1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        Loading wallpaper component...
      </div>
    }>
      <WallpaperComponent key={`wallpaper-${wallpaperKeyRef.current}`} {...wallpaperProps} />
    </Suspense>
  );
};

export default WallpaperRenderer;