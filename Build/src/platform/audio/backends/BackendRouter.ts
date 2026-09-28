import { BaseAudioBackend } from "./BaseBackend";
import { HTMLAudioBackend } from "./HTMLBackend";
import { StreamingDecoderBackend } from "./StreamingDecoderBackend";
import { AudioGraph } from "../graph";
import { isSafari } from "../../utils/safari";
import type { IAudioBackend } from "../index";
import type { Track } from "../../../core/engine/types";

export interface BackendRouterBackends {
  html: IAudioBackend;
  flo: IAudioBackend;
  symphonia: IAudioBackend;
}

export type BackendKind = "flo" | "html" | "symphonia";

export function chooseBackendKind(track?: Track, url?: string): BackendKind {
  if (track) {
    if (track.mimeType === "audio/x-flo") {
      return "flo";
    }
    if (track.hasStoredAudio && !isSafari()) {
      return "symphonia";
    }
    return "html";
  }
  return url?.includes(".flo") ? "flo" : "html";
}

export class BackendRouter extends BaseAudioBackend {
  readonly graph: AudioGraph;
  private htmlBackend: IAudioBackend;
  private floBackend: IAudioBackend;
  private symphoniaBackend: IAudioBackend;
  private current: IAudioBackend;
  private volume = 1;
  private playbackRate = 1;
  private pitch = 0;
  private replayGain: number | null = null;

  private crossfadePartner: IAudioBackend | null = null;
  private crossfadeTimeout: number | null = null;

  constructor(graph?: AudioGraph, backends?: Partial<BackendRouterBackends>) {
    super();
    this.graph = graph ?? new AudioGraph();

    this.htmlBackend = backends?.html ?? new HTMLAudioBackend(this.graph);
    this.floBackend =
      backends?.flo ?? new StreamingDecoderBackend(this.graph, "flo");
    this.symphoniaBackend =
      backends?.symphonia ??
      new StreamingDecoderBackend(this.graph, "symphonia");
    this.current = this.htmlBackend;
  }

  async load(url: string, track?: Track): Promise<void> {
    this.cancelCrossfade();

    switch (chooseBackendKind(track, url)) {
      case "flo":
        await this.switchTo(this.floBackend, url, track);
        break;
      case "symphonia":
        try {
          await this.switchTo(this.symphoniaBackend, url, track);
        } catch {
          await this.switchTo(this.htmlBackend, url, track);
        }
        break;
      case "html":
        await this.switchTo(this.htmlBackend, url, track);
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
    this.cancelCrossfade();
    this.current.stop();
  }

  seek(time: number): void {
    this.cancelCrossfade();
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

  beginCrossfade(
    url: string,
    track: Track | undefined,
    options: { durationMs: number; shape: "linear" | "equalpower" },
  ): Promise<boolean> {
    this.cancelCrossfade();

    const kind = chooseBackendKind(track, url);
    const partner = this.createPartner(kind);
    if (!partner || !this.current.setOutputGain) return Promise.resolve(false);

    const outgoing = this.current;
    const startTime = performance.now();
    const durationMs = Math.max(50, options.durationMs);
    const shape = options.shape;

    partner.setVolume(this.volume);
    partner.setPlaybackRate(this.playbackRate);
    partner.setPitch?.(this.pitch);
    partner.setReplayGain?.(this.replayGain);
    partner.setOutputGain?.(0);
    partner.onTimeUpdate((time) => this.emitTimeUpdate(time));
    partner.onError((error) => this.emitError(error));

    outgoing.offEnded(this.forwardEnded);

    this.crossfadePartner = partner;

    const finish = (): void => {
      if (this.crossfadePartner !== partner) return;
      outgoing.offTimeUpdate(this.forwardTimeUpdate);
      outgoing.offEnded(this.forwardEnded);
      outgoing.offError(this.forwardError);
      partner.onEnded(this.forwardEnded);
      partner.setOutputGain?.(1);
      outgoing.setOutputGain?.(0);
      this.current = partner;
      this.replacePrimary(kind, partner);
      this.crossfadePartner = null;
      this.crossfadeTimeout = null;
      outgoing.dispose();
    };

    const step = (): void => {
      if (this.crossfadePartner !== partner || this.crossfadeTimeout === null) {
        return;
      }
      const progress = Math.min(
        1,
        (performance.now() - startTime) / durationMs,
      );
      const { fromVolume, toVolume } =
        shape === "equalpower"
          ? {
              fromVolume: Math.cos((progress * Math.PI) / 2),
              toVolume: Math.sin((progress * Math.PI) / 2),
            }
          : { fromVolume: 1 - progress, toVolume: progress };
      outgoing.setOutputGain?.(fromVolume);
      partner.setOutputGain?.(toVolume);

      if (progress < 1) {
        this.crossfadeTimeout = window.setTimeout(step, 16);
      } else {
        this.crossfadeTimeout = null;
        finish();
      }
    };

    return (async () => {
      try {
        await partner.load(url, track);
        if (this.crossfadePartner !== partner) {
          partner.dispose();
          return false;
        }
        await partner.play();
        if (this.crossfadePartner !== partner) {
          partner.dispose();
          return false;
        }
      } catch {
        if (this.crossfadePartner === partner) {
          this.crossfadePartner = null;
          outgoing.offEnded(this.forwardEnded);
          outgoing.onEnded(this.forwardEnded);
        }
        partner.dispose();
        return false;
      }

      this.crossfadeTimeout = window.setTimeout(step, 0);
      return true;
    })();
  }

  cancelCrossfade(): void {
    if (this.crossfadeTimeout !== null) {
      clearTimeout(this.crossfadeTimeout);
      this.crossfadeTimeout = null;
    }
    if (this.crossfadePartner) {
      const partner = this.crossfadePartner;
      this.crossfadePartner = null;
      this.current.setOutputGain?.(1);
      this.current.onEnded(this.forwardEnded);
      partner.dispose();
    }
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

  private createPartner(kind: BackendKind): IAudioBackend | null {
    if (kind === "flo") {
      if (this.floBackend instanceof StreamingDecoderBackend) {
        return new StreamingDecoderBackend(this.graph, "flo");
      }
    } else if (kind === "symphonia") {
      if (this.symphoniaBackend instanceof StreamingDecoderBackend) {
        return new StreamingDecoderBackend(this.graph, "symphonia");
      }
    } else if (
      kind === "html" &&
      this.htmlBackend instanceof HTMLAudioBackend
    ) {
      return new HTMLAudioBackend(this.graph);
    }
    return null;
  }

  private replacePrimary(kind: BackendKind, backend: IAudioBackend): void {
    switch (kind) {
      case "flo":
        this.floBackend = backend;
        break;
      case "symphonia":
        this.symphoniaBackend = backend;
        break;
      case "html":
        this.htmlBackend = backend;
        break;
    }
  }
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
    this.cancelCrossfade();
    this.htmlBackend.dispose();
    this.floBackend.dispose();
    this.symphoniaBackend.dispose();
    this.graph.dispose();
    this.current = this.htmlBackend;
    super.dispose();
  }
}
