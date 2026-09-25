import type { AudioGraph } from "../../src/platform/audio/graph";
import type { Track } from "../../src/core/engine/types";

export class StreamingFloBackend {
  constructor(private readonly graph?: AudioGraph) {}

  load(_url: string, _track?: Track): Promise<void> {
    return Promise.resolve();
  }

  play(): Promise<void> {
    return Promise.resolve();
  }

  pause(): void {}

  stop(): void {}

  seek(_time: number): void {}

  setVolume(_volume: number): void {}

  setPlaybackRate(_rate: number): void {}

  setPitch(_semitones: number): void {}

  setReplayGain(_gainDb: number | null): void {}

  getCurrentTime(): number {
    return 0;
  }

  getDuration(): number {
    return 0;
  }

  getAnalyser(): AnalyserNode | null {
    return this.graph?.getAnalyser() ?? null;
  }

  onTimeUpdate(_callback: (time: number) => void): void {}

  offTimeUpdate(_callback: (time: number) => void): void {}

  onEnded(_callback: () => void): void {}

  offEnded(_callback: () => void): void {}

  onError(_callback: (error: Error) => void): void {}

  offError(_callback: (error: Error) => void): void {}

  dispose(): void {}
}