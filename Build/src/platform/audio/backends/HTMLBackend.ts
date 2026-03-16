import { BaseAudioBackend } from "./BaseBackend";

export class HTMLAudioBackend extends BaseAudioBackend {
  private audio: HTMLAudioElement;
  private boundOnTimeUpdate: () => void;
  private boundOnEnded: () => void;
  private boundOnError: () => void;
  private boundOnLoadedMetadata: () => void;
  private duration = 0;

  constructor() {
    super();
    this.audio = new Audio();
    this.audio.preload = "auto";

    this.boundOnTimeUpdate = this.handleTimeUpdate.bind(this);
    this.boundOnEnded = this.handleEnded.bind(this);
    this.boundOnError = this.handleError.bind(this);
    this.boundOnLoadedMetadata = this.handleLoadedMetadata.bind(this);

    this.audio.addEventListener("timeupdate", this.boundOnTimeUpdate);
    this.audio.addEventListener("ended", this.boundOnEnded);
    this.audio.addEventListener("error", this.boundOnError);
    this.audio.addEventListener("loadedmetadata", this.boundOnLoadedMetadata);
  }

  async load(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const onCanPlayThrough = () => {
        this.audio.removeEventListener("canplaythrough", onCanPlayThrough);
        this.audio.removeEventListener("error", onError);
        resolve();
      };

      const onError = () => {
        this.audio.removeEventListener("canplaythrough", onCanPlayThrough);
        this.audio.removeEventListener("error", onError);
        reject(new Error(`Failed to load audio: ${url}`));
      };

      this.audio.addEventListener("canplaythrough", onCanPlayThrough);
      this.audio.addEventListener("error", onError);

      this.audio.src = url;
      this.audio.load();
    });
  }

  async play(): Promise<void> {
    if (this.audio.paused) {
      try {
        await this.audio.play();
      } catch (error) {
        throw new Error(`Play failed: ${(error as Error).message}`);
      }
    }
  }

  pause(): void {
    if (!this.audio.paused) {
      this.audio.pause();
    }
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  seek(time: number): void {
    const wasPlaying = !this.audio.paused;
    this.audio.currentTime = time;
    if (wasPlaying) {
      this.audio.play().catch(() => {});
    }
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  setPlaybackRate(rate: number): void {
    this.audio.playbackRate = Math.max(0.25, Math.min(4, rate));
  }

  getCurrentTime(): number {
    return this.audio.currentTime;
  }

  getDuration(): number {
    return this.duration || this.audio.duration || 0;
  }

  dispose(): void {
    this.audio.removeEventListener("timeupdate", this.boundOnTimeUpdate);
    this.audio.removeEventListener("ended", this.boundOnEnded);
    this.audio.removeEventListener("error", this.boundOnError);
    this.audio.removeEventListener("loadedmetadata", this.boundOnLoadedMetadata);

    this.audio.pause();
    this.audio.src = "";
    this.audio.load();

    
  }

  private handleTimeUpdate(): void {
    this.emitTimeUpdate(this.audio.currentTime);
  }

  private handleEnded(): void {
    this.emitEnded();
  }

  private handleError(): void {
    const error = this.audio.error;
    this.emitError(new Error(error?.message ?? "Unknown audio error"));
  }

  private handleLoadedMetadata(): void {
    this.duration = this.audio.duration;
  }
}

export function createHTMLBackend(): HTMLAudioBackend {
  return new HTMLAudioBackend();
}