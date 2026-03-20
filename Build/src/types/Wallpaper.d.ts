import type { Track } from "../core/engine/types";

declare global {
  interface WallpaperProps {
    currentSong: Track | null;
    playbackState: {
      analyserNode?: AnalyserNode | null;
      isPlaying?: boolean;
    } | null;
  }
}

declare module "htmlplayer/wallpaper" {
  export type { WallpaperProps };
}
