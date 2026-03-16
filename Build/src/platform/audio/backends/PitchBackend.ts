import type { IAudioBackend } from "../index";

let Tone: typeof import("tone") | null = null;
let pitchShift: import("tone").PitchShift | null = null;

async function loadTone(): Promise<typeof import("tone")> {
  if (!Tone) {
    Tone = await import("tone");
    await Tone.start();
  }
  return Tone;
}

export class PitchBackend implements IAudioBackend {
  private inner: IAudioBackend | null = null;
  private currentPitch = 0;
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

    if (!this.isToneLoaded && this.currentPitch !== 0) {
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
    this.inner?.setPlaybackRate(rate);
  }

  async setPitch(semitones: number): Promise<void> {
    this.currentPitch = semitones;

    if (semitones !== 0 && !this.isToneLoaded) {
      await this.initializeTone();
    }

    if (pitchShift) {
      pitchShift.pitch = semitones;
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

  offTimeUpdate(_callback: (time: number) => void): void {
  }

  onEnded(callback: () => void): void {
    this.inner?.onEnded(callback);
  }

  offEnded(_callback: () => void): void {
  }

  onError(callback: (error: Error) => void): void {
    this.inner?.onError(callback);
  }

  offError(_callback: (error: Error) => void): void {
  }

  dispose(): void {
    if (pitchShift) {
      pitchShift.dispose();
      pitchShift = null;
    }

    this.inner?.dispose();
    this.inner = null;
    this.isToneLoaded = false;
  }

  private async initializeTone(): Promise<void> {
    const tone = await loadTone();
    this.isToneLoaded = true;

    pitchShift = new tone.PitchShift({
      pitch: this.currentPitch,
      windowSize: 0.1,
    });
  }

  getPitchShift(): import("tone").PitchShift | null {
    return pitchShift;
  }
}

export function createPitchBackend(inner?: IAudioBackend): PitchBackend {
  const backend = new PitchBackend();
  if (inner) {
    backend.setInnerBackend(inner);
  }
  return backend;
}