import type { IAudioBackend } from "../index";
import type { Track } from "../../../core/engine/types";

export class PitchBackend implements IAudioBackend {
  private inner: IAudioBackend | null = null;

  constructor(inner?: IAudioBackend) {
    if (inner) {
      this.inner = inner;
    }
  }

  setInnerBackend(backend: IAudioBackend): void {
    this.inner = backend;
  }

  async load(url: string, track?: Track): Promise<void> {
    if (!this.inner) {
      throw new Error("No inner backend configured");
    }
    await this.inner.load(url, track);
  }

  async play(): Promise<void> {
    await this.inner?.play();
  }

  pause(): void {
    this.inner?.pause();
  }

  stop(): void {
    this.inner?.stop();
  }

  seek(time: number): void {
    this.inner?.seek(time);
  }

  setVolume(volume: number): void {
    this.inner?.setVolume(volume);
  }

  setPlaybackRate(rate: number): void {
    this.inner?.setPlaybackRate(rate);
  }

  async setPitch(semitones: number): Promise<void> {
    await this.inner?.setPitch?.(semitones);
  }

  getCurrentTime(): number {
    return this.inner?.getCurrentTime() ?? 0;
  }

  getDuration(): number {
    return this.inner?.getDuration() ?? 0;
  }

  onTimeUpdate(callback: (time: number) => void): void {
    this.inner?.onTimeUpdate(callback);
  }

  offTimeUpdate(callback: (time: number) => void): void {
    this.inner?.offTimeUpdate(callback);
  }

  onEnded(callback: () => void): void {
    this.inner?.onEnded(callback);
  }

  offEnded(callback: () => void): void {
    this.inner?.offEnded(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.inner?.onError(callback);
  }

  offError(callback: (error: Error) => void): void {
    this.inner?.offError(callback);
  }

  dispose(): void {
    this.inner?.dispose();
    this.inner = null;
  }
}

export function createPitchBackend(inner?: IAudioBackend): PitchBackend {
  return new PitchBackend(inner);
}