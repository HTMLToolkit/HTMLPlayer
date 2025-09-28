interface CachedSong {
  song: Song;
  audioBuffer: ArrayBuffer;
  url: string;
  loadedAt: number;
}