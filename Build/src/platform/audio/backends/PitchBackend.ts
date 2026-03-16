import type { IAudioBackend } from "../index";

interface TonePlayerInstance {
  pitch: number;
  playbackRate: number;
  dispose: () => void;
}

let Tone: typeof import("tone") | null = null;
let playerInstance: TonePlayerInstance | null = null;

async function loadTone(): Promise<typeof import("tone")> {
  if (!Tone) {
    Tone = await import("tone");
    await Tone.start();
  }
  return Tone;
}

export class PitchBackend implements IAudioBackend {
  private inner: IAudioBackend | null = null;
  private pitchShift: import("tone").PitchShift | null = null;
  private isToneLoaded = false;
  private pendingLoad: (() => Promise<void>) | null = null;

  setInnerBackend(backend: IAudioBackend): void {
    this.inner = backend;
  }

  async load(url: string): Promise<void> {
    if (!this.inner) {
      throw new Error("No inner backend configured");
    }

    if (this.pendingLoad) {
      this.pendingLoad = null;
    }

    this.pendingLoad = async () => {
      await this.inner!.load(url);
    };

    await this.pendingLoad();
  }

  async play(): Promise<void> {
    if (!this.inner) return;

    if (!this.isToneLoaded) {
      await this.initializeTone();
    }

    await this.inner.play();
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
    if (playerInstance) {
      playerInstance.playbackRate = rate;
    }
    this.inner?.setPlaybackRate(rate);
  }

  async setPitch(semitones: number): Promise<void> {
    if (!this.isToneLoaded) {
      await this.initializeTone();
    }

    if (playerInstance) {
      playerInstance.pitch = semitones;
    }
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

  onEnded(callback: () => void): void {
    this.inner?.onEnded(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.inner?.onError(callback);
  }

  dispose(): void {
    if (playerInstance) {
      playerInstance.dispose();
      playerInstance = null;
    }

    if (this.pitchShift) {
      this.pitchShift.dispose();
      this.pitchShift = null;
    }

    this.inner?.dispose();
    this.inner = null;
  }

  private async initializeTone(): Promise<void> {
    const tone = await loadTone();
    this.isToneLoaded = true;

    const player = new tone.Player().toDestination();
    playerInstance = player;

    this.pitchShift = new tone.PitchShift({
      pitch: 0,
      windowSize: 0.1,
    });
  }

  getTonePlayer(): TonePlayerInstance | null {
    return playerInstance;
  }
}

export function createPitchBackend(inner?: IAudioBackend): PitchBackend {
  const backend = new PitchBackend();
  if (inner) {
    backend.setInnerBackend(inner);
  }
  return backend;
}