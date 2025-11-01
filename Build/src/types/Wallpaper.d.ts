interface WallpaperProps {
  currentSong: Song | null;
  playbackState: PlayerState | null;
}

// Allow developers to optionally export more advanced types later
declare module 'htmlplayer/wallpaper' {
  export type { WallpaperProps };
}
