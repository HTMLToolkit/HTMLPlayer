import { BaseAudioBackend } from "./BaseBackend";
import { HTMLAudioBackend } from "./HTMLBackend";
import { WebAudioBackend } from "./WebAudioBackend";
import { throwError } from "../../../helpers/logger";

export class HybridBackend extends BaseAudioBackend {
  private htmlBackend: HTMLAudioBackend | null = null;
  private webAudioBackend: WebAudioBackend | null = null;
  private currentBackend: BaseAudioBackend | null = null;
  private useWebAudio: boolean = true;
  private useHTML5Audio: boolean = true;

  constructor(options?: { useWebAudio?: boolean; useHTML5Audio?: boolean }) {
    super();
    this.useWebAudio = options?.useWebAudio ?? true;
    this.useHTML5Audio = options?.useHTML5Audio ?? true;
  }

  private ensureHTMLBackend(): HTMLAudioBackend {
    if (!this.htmlBackend) {
      this.htmlBackend = new HTMLAudioBackend();
      this.setupCallbacks(this.htmlBackend);
    }
    return this.htmlBackend;
  }

  private ensureWebAudioBackend(): WebAudioBackend {
    if (!this.webAudioBackend) {
      this.webAudioBackend = new WebAudioBackend();
      this.setupCallbacks(this.webAudioBackend);
    }
    return this.webAudioBackend;
  }

  private setupCallbacks(backend: BaseAudioBackend): void {
    backend.onTimeUpdate((t) => this.emitTimeUpdate(t));
    backend.onEnded(() => this.emitEnded());
    backend.onError((e) => this.emitError(e));
  }

  async load(url: string): Promise<void> {
    if (this.useHTML5Audio) {
      this.currentBackend = this.ensureHTMLBackend();
    } else if (this.useWebAudio) {
      this.currentBackend = this.ensureWebAudioBackend();
    } else {
      return throwError("No backend available");
    }

    await this.currentBackend.load(url);
  }

  async play(): Promise<void> {
    if (!this.currentBackend) return;
    await this.currentBackend.play();
  }

  pause(): void {
    this.currentBackend?.pause();
  }

  stop(): void {
    this.currentBackend?.stop();
  }

  seek(time: number): void {
    this.currentBackend?.seek(time);
  }

  setVolume(volume: number): void {
    this.htmlBackend?.setVolume(volume);
    this.webAudioBackend?.setVolume(volume);
  }

  setPlaybackRate(rate: number): void {
    this.currentBackend?.setPlaybackRate(rate);
  }

  getCurrentTime(): number {
    return this.currentBackend?.getCurrentTime() ?? 0;
  }

  getDuration(): number {
    return this.currentBackend?.getDuration() ?? 0;
  }

  dispose(): void {
    this.htmlBackend?.dispose();
    this.webAudioBackend?.dispose();
    this.htmlBackend = null;
    this.webAudioBackend = null;
    this.currentBackend = null;
    super.dispose();
  }
}

export function createHybridBackend(options?: {
  useWebAudio?: boolean;
  useHTML5Audio?: boolean;
}): HybridBackend {
  return new HybridBackend(options);
}
