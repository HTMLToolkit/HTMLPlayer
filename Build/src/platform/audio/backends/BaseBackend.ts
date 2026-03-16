import type { IAudioBackend } from "../../audio/index";

export abstract class BaseAudioBackend implements IAudioBackend {
  protected timeUpdateCallbacks: Set<(time: number) => void> = new Set();
  protected endedCallbacks: Set<() => void> = new Set();
  protected errorCallbacks: Set<(error: Error) => void> = new Set();

  abstract load(url: string): Promise<void>;
  abstract play(): Promise<void>;
  abstract pause(): void;
  abstract stop(): void;
  abstract seek(time: number): void;
  abstract setVolume(volume: number): void;
  abstract setPlaybackRate(rate: number): void;
  abstract getCurrentTime(): number;
  abstract getDuration(): number;

  dispose(): void {
    this.timeUpdateCallbacks.clear();
    this.endedCallbacks.clear();
    this.errorCallbacks.clear();
  }

  onTimeUpdate(callback: (time: number) => void): void {
    this.timeUpdateCallbacks.add(callback);
  }

  offTimeUpdate(callback: (time: number) => void): void {
    this.timeUpdateCallbacks.delete(callback);
  }

  onEnded(callback: () => void): void {
    this.endedCallbacks.add(callback);
  }

  offEnded(callback: () => void): void {
    this.endedCallbacks.delete(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback);
  }

  offError(callback: (error: Error) => void): void {
    this.errorCallbacks.delete(callback);
  }

  protected emitTimeUpdate(time: number): void {
    this.timeUpdateCallbacks.forEach((cb) => cb(time));
  }

  protected emitEnded(): void {
    this.endedCallbacks.forEach((cb) => cb());
  }

  protected emitError(error: Error): void {
    this.errorCallbacks.forEach((cb) => cb(error));
  }
}