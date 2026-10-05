import { BaseAudioBackend } from "./BaseBackend";
import { AudioGraph } from "../graph";
import { clampRate } from "../clamp";
import { throwError } from "../../../helpers/logger";
import { sniffAudioFailure, trackCodecFailure } from "../playability";
import type { Track } from "../../../core/engine/types";

export class HTMLAudioBackend extends BaseAudioBackend {
  private audio: HTMLAudioElement;
  private graph: AudioGraph;
  private ownsGraph: boolean;
  private outputGain: GainNode | null = null;
  private boundOnTimeUpdate: () => void;
  private boundOnEnded: () => void;
  private boundOnError: () => void;
  private boundOnLoadedMetadata: () => void;
  private duration = 0;

  constructor(graph?: AudioGraph) {
    super();
    this.graph = graph ?? new AudioGraph();
    this.ownsGraph = !graph;

    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.volume = 1;

    this.routeAudioElement();

    this.boundOnTimeUpdate = this.handleTimeUpdate.bind(this);
    this.boundOnEnded = this.handleEnded.bind(this);
    this.boundOnError = this.handleError.bind(this);
    this.boundOnLoadedMetadata = this.handleLoadedMetadata.bind(this);

    this.audio.addEventListener("timeupdate", this.boundOnTimeUpdate);
    this.audio.addEventListener("ended", this.boundOnEnded);
    this.audio.addEventListener("error", this.boundOnError);
    this.audio.addEventListener("loadedmetadata", this.boundOnLoadedMetadata);
  }

  async load(url: string, track?: Track): Promise<void> {
    const failure =
      (track ? trackCodecFailure(track) : null) ??
      (await sniffAudioFailure(url, {
        hasStoredAudio: track?.hasStoredAudio === true,
      }));
    if (failure) {
      throw new Error(
        `Cannot play "${track?.title ?? "this track"}": ${failure.codecName} is not supported by ${failure.browser}. Convert the file to FLAC, MP3, or AAC, or use Safari.`,
      );
    }

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
    this.graph.resume();
    if (this.audio.paused) {
      try {
        await this.audio.play();
      } catch (error) {
        return throwError(`Play failed: ${(error as Error).message}`);
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
    this.graph.setVolume(volume);
  }

  setOutputGain(value: number): void {
    if (this.outputGain) {
      this.outputGain.gain.value = value;
    }
  }

  setPlaybackRate(rate: number): void {
    this.audio.playbackRate = clampRate(rate);
  }

  getCurrentTime(): number {
    return this.audio.currentTime;
  }

  getAnalyser(): AnalyserNode | null {
    return this.graph.getAnalyser();
  }

  getDuration(): number {
    return this.duration || this.audio.duration || 0;
  }

  dispose(): void {
    this.audio.removeEventListener("timeupdate", this.boundOnTimeUpdate);
    this.audio.removeEventListener("ended", this.boundOnEnded);
    this.audio.removeEventListener("error", this.boundOnError);
    this.audio.removeEventListener(
      "loadedmetadata",
      this.boundOnLoadedMetadata,
    );

    this.audio.pause();
    this.audio.src = "";
    this.audio.load();

    if (this.ownsGraph) {
      this.graph.dispose();
    }
    super.dispose();
  }

  private routeAudioElement(): void {
    try {
      this.outputGain = this.graph.createSlot();
      this.graph.connectMediaElement(this.audio, this.outputGain);
    } catch {}
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
