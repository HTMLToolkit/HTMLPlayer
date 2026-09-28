import { BaseAudioBackend } from "./BaseBackend";
import { AudioGraph } from "../graph";
import { clampRate } from "../clamp";
import { StreamDecoderClient } from "../stream/StreamDecoderClient";
import type {
  FloStreamInfo,
  FloStreamPumpEvents,
} from "../stream/FloStreamPump";
import type { StreamDecoderEngine } from "../stream/StreamDecoder.worker";
import type { Track } from "../../../core/engine/types";

const TIME_UPDATE_MS = 100;
const FLUSH_MS = 120;
const WORKLET_NAME = "flo-stream-output";
const WORKLET_OUTPUT_CHANNELS = 2;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const workletModuleCache = new WeakMap<BaseAudioContext, Promise<void>>();

const loadWorkletModule = (ctx: AudioContext): Promise<void> => {
  let pending = workletModuleCache.get(ctx);
  if (!pending) {
    pending = ctx.audioWorklet.addModule(
      new URL("../stream/FloStreamWorklet.js", import.meta.url).href,
    );
    workletModuleCache.set(ctx, pending);
  }
  return pending;
};

export class StreamingDecoderBackend extends BaseAudioBackend {
  private readonly graph: AudioGraph;
  private readonly engine: StreamDecoderEngine;
  private readonly ownsGraph: boolean;
  private outputGain: GainNode | null = null;
  private currentUrl = "";
  private stream: StreamDecoderClient | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private channels = 2;
  private sampleRate = 44100;
  private duration = 0;
  private pausedAt = 0;
  private startTime = 0;
  private playing = false;
  private playbackRate = 1;
  private receivedAudio = false;
  private receivedInfo = false;
  private pumpFailure: Error | null = null;
  private resumeIntent = false;
  private pendingChunks: Float32Array[] = [];
  private timeUpdateTimer: number | null = null;
  private flushTimer: number | null = null;
  private streamGeneration = 0;

  constructor(graph?: AudioGraph, engine: StreamDecoderEngine = "flo") {
    super();
    this.graph = graph ?? new AudioGraph();
    this.engine = engine;
    this.ownsGraph = !graph;
  }

  async load(url: string, track?: Track): Promise<void> {
    this.cancelCurrentStream();
    this.currentUrl = url;
    this.duration = track?.duration ?? 0;
    this.pausedAt = 0;
    this.playing = false;
    this.resumeIntent = false;
    this.receivedAudio = false;
    this.receivedInfo = false;
    this.pumpFailure = null;
    this.stopTimers();

    const ctx = this.graph.getContext();
    await loadWorkletModule(ctx);
    this.createWorkletNode();
    this.startFlushTimer();

    const generation = this.streamGeneration;
    const stream = this.ensureStream();

    await stream.start(this.currentUrl, 0);
    if (generation !== this.streamGeneration) return;
    if (this.pumpFailure) {
      throw this.pumpFailure;
    }
    if (!this.receivedAudio && !this.receivedInfo) {
      throw new Error(`${this.engine} stream contained no audio`);
    }
  }

  async play(): Promise<void> {
    if (!this.workletNode || !this.stream) return;
    if (this.duration > 0 && this.pausedAt + 0.05 >= this.duration) {
      this.emitEnded();
      return;
    }
    this.startPlayback(this.pausedAt);
  }

  pause(): void {
    if (!this.playing) return;
    this.pausedAt = clamp(this.getCurrentTime(), 0, this.duration);
    this.playing = false;
    this.resumeIntent = false;
    this.postWorklet({ type: "pause" });
    this.stopTimeUpdateTimer();
  }

  stop(): void {
    this.cancelCurrentStream();
    this.pausedAt = 0;
    this.playing = false;
    this.resumeIntent = false;
    this.stopTimers();
    this.emitTimeUpdate(0);
  }

  seek(time: number): void {
    const wasPlaying = this.playing || this.resumeIntent;
    this.cancelCurrentStream();
    const clamped = clamp(time, 0, this.duration);
    this.pausedAt = clamped;
    this.playing = false;
    this.resumeIntent = wasPlaying;
    this.stopTimeUpdateTimer();
    this.emitTimeUpdate(clamped);

    if (this.duration <= 0 || this.sampleRate <= 0) {
      this.resumeIntent = false;
      return;
    }
    void this.restartStream(clamped, wasPlaying);
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
    this.playbackRate = clampRate(rate);
    this.postWorklet({ type: "rate", rate: this.playbackRate });
  }

  setReplayGain(gainDb: number | null): void {
    this.graph.setReplayGain(gainDb);
  }

  getCurrentTime(): number {
    if (this.playing) {
      const elapsed =
        (this.getGraphTime() - this.startTime) * this.playbackRate;
      return clamp(elapsed, 0, this.duration);
    }
    return clamp(this.pausedAt, 0, this.duration);
  }

  getDuration(): number {
    return this.duration;
  }

  getAnalyser(): AnalyserNode | null {
    return this.graph.getAnalyser();
  }

  dispose(): void {
    this.cancelCurrentStream();
    if (this.workletNode) {
      this.postWorklet({ type: "flush" });
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    this.stopTimers();
    this.stream?.dispose();
    this.stream = null;
    if (this.ownsGraph) {
      this.graph.dispose();
    }
    super.dispose();
  }

  private ensureStream(): StreamDecoderClient {
    if (this.stream) return this.stream;
    const events: FloStreamPumpEvents = {
      onInfo: (info) => this.handleInfo(info, this.streamGeneration),
      onChunk: (chunk) => this.handleChunk(chunk, this.streamGeneration),
      onEnd: () => this.handleStreamEnd(this.streamGeneration),
      onError: (error) => this.handleStreamError(error, this.streamGeneration),
    };
    this.stream = new StreamDecoderClient({
      engine: this.engine,
      events,
    });
    return this.stream;
  }

  private async restartStream(
    time: number,
    resumingPlayback: boolean,
  ): Promise<void> {
    const generation = ++this.streamGeneration;
    const stream = this.ensureStream();

    await stream.start(this.currentUrl, Math.floor(time * this.sampleRate));
    if (generation !== this.streamGeneration) return;
    if (this.pumpFailure) {
      this.emitError(this.pumpFailure);
      return;
    }

    this.postWorklet({
      type: "configure",
      channels: this.channels,
      sampleRate: this.sampleRate,
    });
    this.flushPendingChunks();
    if (resumingPlayback) {
      this.resumeIntent = false;
      this.startPlayback(time);
    }
  }

  private startPlayback(atTime: number): void {
    this.pausedAt = atTime;
    this.graph.resume();
    this.startTime = this.getGraphTime() - atTime;
    this.playing = true;
    this.postWorklet({ type: "play", rate: this.playbackRate });
    this.flushPendingChunks();
    this.startTimeUpdateTimer();
  }

  private handleInfo(info: FloStreamInfo, generation: number): void {
    if (generation !== this.streamGeneration) return;
    this.receivedInfo = true;
    this.sampleRate = info.sample_rate || 44100;
    this.channels = info.channels || 2;
    if (info.total_samples && info.total_samples > 0) {
      this.duration = Number(info.total_samples) / this.sampleRate;
    }
    this.postWorklet({
      type: "configure",
      channels: this.channels,
      sampleRate: this.sampleRate,
    });
  }

  private handleChunk(chunk: Float32Array, generation: number): void {
    if (generation !== this.streamGeneration) return;
    this.receivedAudio = true;
    if (chunk.length > 0) {
      this.pendingChunks.push(chunk);
    }
  }

  private handleStreamEnd(generation: number): void {
    if (generation !== this.streamGeneration) return;
    this.postWorklet({ type: "endOfStream" });
  }

  private handleStreamError(error: Error, generation: number): void {
    if (generation !== this.streamGeneration) return;
    this.pumpFailure = error;
    this.emitError(error);
  }

  private handleWorkletEnded(): void {
    if (!this.playing) return;
    this.pausedAt = this.duration;
    this.playing = false;
    this.stopTimeUpdateTimer();
    this.emitEnded();
  }

  private flushPendingChunks(): void {
    if (!this.workletNode || this.pendingChunks.length === 0) return;
    const chunks = this.pendingChunks.splice(0);
    for (const chunk of chunks) {
      this.postWorklet({ type: "append", data: chunk });
    }
  }

  private postWorklet(message: object): void {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage(message);
  }

  private createWorkletNode(): void {
    if (this.workletNode) {
      this.postWorklet({ type: "flush" });
      return;
    }
    const ctx = this.graph.getContext();
    const node = new AudioWorkletNode(ctx, WORKLET_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [WORKLET_OUTPUT_CHANNELS],
    });
    const message = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data && data.type === "ended") {
        this.handleWorkletEnded();
      }
    };
    node.port.onmessage = message;
    if (!this.outputGain) {
      this.outputGain = this.graph.createSlot();
    }
    node.connect(this.outputGain);
    this.workletNode = node;
  }

  private cancelCurrentStream(): void {
    this.streamGeneration++;
    this.stream?.cancel();
    this.pendingChunks = [];
    this.postWorklet({ type: "flush" });
  }

  private getGraphTime(): number {
    try {
      return this.graph.getContext().currentTime;
    } catch {
      return this.pausedAt;
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setInterval(() => {
      this.flushPendingChunks();
    }, FLUSH_MS);
  }

  private startTimeUpdateTimer(): void {
    if (this.timeUpdateTimer !== null) return;
    this.timeUpdateTimer = window.setInterval(() => {
      this.emitTimeUpdate(this.getCurrentTime());
    }, TIME_UPDATE_MS);
  }

  private stopTimeUpdateTimer(): void {
    if (this.timeUpdateTimer !== null) {
      clearInterval(this.timeUpdateTimer);
      this.timeUpdateTimer = null;
    }
  }

  private stopTimers(): void {
    this.stopTimeUpdateTimer();
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
