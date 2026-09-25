import { BaseAudioBackend } from "./BaseBackend";
import { HTMLAudioBackend } from "./HTMLBackend";
import { WebAudioBackend } from "./WebAudioBackend";
import { FloBackend } from "./FloBackend";
import { AudioGraph } from "../graph";
import type { IAudioBackend } from "../index";
import type { Track } from "../../../core/engine/types";

export interface BackendRouterBackends {
  html: IAudioBackend;
  webAudio: IAudioBackend;
  flo: IAudioBackend;
}

export type BackendKind = "flo" | "webaudio" | "html";

const DECODE_MIME_TYPES = ["audio/x-flo", "audio/flac", "audio/wav"];

export function chooseBackendKind(
  track?: Track,
  url?: string,
): BackendKind {
  if (track) {
    const mimeType = track.mimeType;
    if (mimeType && DECODE_MIME_TYPES.includes(mimeType)) {
      return mimeType === "audio/x-flo" ? "flo" : "webaudio";
    }
    return "html";
  }
  return url?.includes(".flo") ? "flo" : "html";
}

export class BackendRouter extends BaseAudioBackend {
  readonly graph: AudioGraph;
  private htmlBackend: IAudioBackend;
  private webAudioBackend: IAudioBackend;
  private floBackend: IAudioBackend;
  private current: IAudioBackend;
  private volume = 1;
  private playbackRate = 1;
  private pitch = 0;
  private replayGain: number | null = null;

  constructor(graph?: AudioGraph, backends?: Partial<BackendRouterBackends>) {
    super();
    this.graph = graph ?? new AudioGraph();

    this.htmlBackend = backends?.html ?? new HTMLAudioBackend(this.graph);
    this.webAudioBackend = backends?.webAudio ?? new WebAudioBackend(this.graph);
    this.floBackend = backends?.flo ?? new FloBackend(this.graph);
    this.current = this.htmlBackend;
  }

  async load(url: string, track?: Track): Promise<void> {
    switch (chooseBackendKind(track, url)) {
      case "flo":
        await this.switchTo(this.floBackend, url, track);
        break;
      case "webaudio":
        try {
          await this.switchTo(this.webAudioBackend, url, track);
        } catch {
          await this.switchTo(this.htmlBackend, url, track);
        }
        break;
      case "html":
        try {
          await this.switchTo(this.htmlBackend, url, track);
        } catch (htmlError) {
          try {
            await this.switchTo(this.webAudioBackend, url, track);
          } catch {
            throw htmlError;
          }
        }
        break;
    }
  }

  async play(): Promise<void> {
    await this.current.play();
  }

  pause(): void {
    this.current.pause();
  }

  stop(): void {
    this.current.stop();
  }

  seek(time: number): void {
    this.current.seek(time);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.current.setVolume(volume);
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    this.current.setPlaybackRate(rate);
  }

  setPitch(semitones: number): void {
    this.pitch = semitones;
    void this.graph.setPitch(semitones);
  }

  setReplayGain(gainDb: number | null): void {
    this.replayGain = gainDb;
    this.graph.setReplayGain(gainDb);
  }

  getEqualizer(): import("../equalizer").Equalizer {
    return this.graph.getEqualizer();
  }

  setEqualizer(enabled: boolean): void {
    this.graph.setEqualizer(enabled);
  }

  getCurrentTime(): number {
    return this.current.getCurrentTime();
  }

  getDuration(): number {
    return this.current.getDuration();
  }

  getAnalyser(): AnalyserNode | null {
    return this.graph.getAnalyser();
  }

  private readonly forwardTimeUpdate = (time: number) => {
    this.emitTimeUpdate(time);
  };
  private readonly forwardEnded = () => {
    this.emitEnded();
  };
  private readonly forwardError = (error: Error) => {
    this.emitError(error);
  };

  private async switchTo(
    backend: IAudioBackend,
    url: string,
    track?: Track,
  ): Promise<void> {
    if (backend !== this.current) {
      this.current.offTimeUpdate(this.forwardTimeUpdate);
      this.current.offEnded(this.forwardEnded);
      this.current.offError(this.forwardError);
      this.current = backend;
      backend.onTimeUpdate(this.forwardTimeUpdate);
      backend.onEnded(this.forwardEnded);
      backend.onError(this.forwardError);
    }

    backend.setVolume(this.volume);
    backend.setPlaybackRate(this.playbackRate);
    backend.setPitch?.(this.pitch);
    backend.setReplayGain?.(this.replayGain);

    await backend.load(url, track);
  }

  dispose(): void {
    this.htmlBackend.dispose();
    this.webAudioBackend.dispose();
    this.floBackend.dispose();
    this.graph.dispose();
    this.current = this.htmlBackend;
    super.dispose();
  }
}