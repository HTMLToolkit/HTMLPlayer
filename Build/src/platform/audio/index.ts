import type { Track } from "../../core/engine/types";

export interface IAudioBackend {
  /**
   * @param url Playable source (blob or http url) for the track.
   * @param track The track being loaded, when the caller knows it. Backends
   *   use it to make routing/decoding decisions (e.g. native flo) without
   *   having to infer the format from the url, which is often a blob url.
   */
  load(url: string, track?: Track): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  getAnalyser?: () => AnalyserNode | null;
  setPitch?(semitones: number): void | Promise<void>;
  setReplayGain?(gainDb: number | null): void;
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
