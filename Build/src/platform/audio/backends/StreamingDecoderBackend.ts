import { BaseAudioBackend } from "./BaseBackend";
import { AudioGraph } from "../graph";
import { clampRate } from "../clamp";
import { StreamDecoderClient } from "../stream/StreamDecoderClient";
import type {
  FloStreamInfo,
  FloStreamPumpEvents,
} from "../stream/FloStreamPump";
import type { StreamDecoderEngine } from "../stream/StreamDecoder.worker";
import floWorkletSource from "../stream/floWorkletSource";
import type { Track } from "../../../core/engine/types";
import { createLogger } from "../../../helpers/logger";

const logger = createLogger("StreamingDecoderBackend");

const TIME_UPDATE_MS = 100;
const FLUSH_MS = 120;
const WORKLET_NAME = "flo-stream-output";
const WORKLET_OUTPUT_CHANNELS = 2;
const HIGH_WATERMARK_SECONDS = 2;
const LOW_WATERMARK_SECONDS = 1;
const HARD_CAP_SECONDS = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const chunkFrames = (chunk: Float32Array, channels: number): number =>
  Math.floor(chunk.length / Math.max(1, channels));

const clampToDuration = (value: number, duration: number): number =>
  duration > 0 ? clamp(value, 0, duration) : Math.max(0, value);

const workletModuleCache = new WeakMap<BaseAudioContext, Promise<void>>();

const describeWorkletLoadFailure = (error: unknown): string =>
  [
    "Could not load the streaming output worklet from its inlined Blob URL.",
    "Browsers refuse an AudioWorklet module load from a Blob URL when the",
    "document has an opaque origin, which is what a Chromium `file://` page",
    "has, so the single-file build cannot stream-decode there. Serve the app",
    "over http://localhost or HTTPS to restore it.",
    `Underlying error: ${String(error)}`,
  ].join(" ");

const loadWorkletModule = async (ctx: AudioContext): Promise<void> => {
  const cached = workletModuleCache.get(ctx);
  if (cached) return cached;

  const source = URL.createObjectURL(
    new Blob([floWorkletSource], { type: "text/javascript" }),
  );
  const pending = ctx.audioWorklet
    .addModule(source)
    .catch((error: unknown) => {
      workletModuleCache.delete(ctx);
      throw new Error(describeWorkletLoadFailure(error));
    })
    .finally(() => URL.revokeObjectURL(source));

  workletModuleCache.set(ctx, pending);
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
  private pausedByPressure = false;
  private bufferedFrames = 0;
  private decodeComplete = false;
  private endOfStreamSent = false;
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
    this.pausedAt = clampToDuration(this.getCurrentTime(), this.duration);
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
    const clamped = clampToDuration(time, this.duration);
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
      return clampToDuration(elapsed, this.duration);
    }
    return clampToDuration(this.pausedAt, this.duration);
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
    const client = new StreamDecoderClient({
      engine: this.engine,
      events,
    });
    this.stream = client;
    return client;
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

    this.postConfigure();
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
    this.postConfigure();
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
    this.decodeComplete = true;
    this.signalEndOfStreamWhenFlushed();
  }

  private signalEndOfStreamWhenFlushed(): void {
    if (!this.decodeComplete || this.endOfStreamSent) return;
    if (this.pendingChunks.length > 0) return;
    this.endOfStreamSent = true;
    this.postWorklet({ type: "endOfStream" });
  }

  private handleStreamError(error: Error, generation: number): void {
    if (generation !== this.streamGeneration) return;
    this.pumpFailure = error;
    this.emitError(error);
  }

  private handleWorkletLevel(shouldPause: boolean, buffered?: number): void {
    if (buffered !== undefined) {
      this.bufferedFrames = buffered;
    }
    const wasPaused = this.pausedByPressure;
    this.pausedByPressure = shouldPause;
    if (wasPaused !== shouldPause) {
      this.stream?.setPressure(shouldPause);
    }
    if (!shouldPause) {
      this.flushPendingChunks();
    }
  }

  private handleWorkletEnded(): void {
    if (!this.playing) return;
    this.pausedAt = this.duration;
    this.playing = false;
    this.stopTimeUpdateTimer();
    this.emitEnded();
  }

  private flushPendingChunks(): void {
    if (!this.workletNode || this.pausedByPressure) return;
    if (this.pendingChunks.length === 0) return;
    const budget = Math.max(
      0,
      this.highWatermarkFrames() - this.bufferedFrames,
    );
    if (budget <= 0) return;
    let sent = 0;
    while (this.pendingChunks.length > 0 && sent < budget) {
      const chunk = this.pendingChunks.shift()!;
      const frames = chunkFrames(chunk, this.channels);
      sent += frames;
      this.bufferedFrames += frames;
      this.postWorklet({ type: "append", data: chunk });
    }
    this.signalEndOfStreamWhenFlushed();
  }

  private highWatermarkFrames(): number {
    return Math.round(HIGH_WATERMARK_SECONDS * this.sampleRate);
  }

  private postConfigure(): void {
    this.postWorklet({
      type: "configure",
      channels: this.channels,
      sampleRate: this.sampleRate,
      highWatermarkSeconds: HIGH_WATERMARK_SECONDS,
      lowWatermarkSeconds: LOW_WATERMARK_SECONDS,
      hardCapSeconds: HARD_CAP_SECONDS,
    });
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
      const data = event.data as {
        type?: string;
        paused?: boolean;
        buffered?: number;
        frames?: number;
        cap?: number;
      } | null;
      if (!data) return;
      if (data.type === "ended") {
        this.handleWorkletEnded();
      } else if (data.type === "level") {
        this.handleWorkletLevel(Boolean(data.paused), data.buffered);
      } else if (data.type === "overflow") {
        logger.warn(
          `${this.engine} output ring exceeded cap: ${data.frames ?? 0} frames buffered against ${data.cap ?? 0}`,
        );
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
    if (this.pausedByPressure) {
      this.stream?.setPressure(false);
    }
    this.stream?.cancel();
    this.pausedByPressure = false;
    this.pendingChunks = [];
    this.bufferedFrames = 0;
    this.decodeComplete = false;
    this.endOfStreamSent = false;
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
