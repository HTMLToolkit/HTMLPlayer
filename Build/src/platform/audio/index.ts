export interface IAudioBackend {
  load(url: string): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  onTimeUpdate(callback: (time: number) => void): void;
  offTimeUpdate(callback: (time: number) => void): void;
  onEnded(callback: () => void): void;
  offEnded(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  offError(callback: (error: Error) => void): void;
  dispose(): void;
}

export type AudioBackendType = "html" | "webaudio" | "hybrid" | "custom";

export interface AudioBackendOptions {
  type: AudioBackendType;
  preload?: boolean;
  preloadCount?: number;
}

export interface AudioBackendFactory {
  create(options?: Partial<AudioBackendOptions>): IAudioBackend;
}