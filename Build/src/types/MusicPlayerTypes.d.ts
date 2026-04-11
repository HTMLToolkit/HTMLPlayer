import type { Track } from "../core/engine/types";

declare global {
  interface CachedSong {
    song: Track;
    url: string;
    loadedAt: number;
  }
}
