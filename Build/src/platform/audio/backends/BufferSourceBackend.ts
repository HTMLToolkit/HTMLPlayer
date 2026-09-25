import { BaseAudioBackend } from "./BaseBackend";
import { AudioGraph } from "../graph";
import { clampRate } from "../clamp";

export abstract class BufferSourceBackend extends BaseAudioBackend {
  protected graph: AudioGraph;
  private ownsGraph: boolean;
  private audioBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private duration = 0;
  private playbackRate = 1;
  private startTime = 0;
  private pausedAt = 0;
  private timeUpdateInterval: number | null = null;

  constructor(graph?: AudioGraph) {
    super();
    this.graph = graph ?? new AudioGraph();
    this.ownsGraph = !graph;
  }

  protected abstract decode(
    url: string,
    context: AudioContext,
  ): Promise<AudioBuffer>;

  async load(url: string): Promise<void> {
    this.resetPlayback();

    const context = this.graph.getContext();
    try {
      const buffer = await this.decode(url, context);
      this.audioBuffer = buffer;
      this.duration = buffer.duration;
      this.pausedAt = 0;
    } catch (error) {
      throw new Error(`Failed to load audio: ${(error as Error).message}`);
    }
  }

  async play(): Promise<void> {
    if (!this.audioBuffer) return;

    if (this.source) {
      this.stopAndClearSource();
    }

    this.graph.resume();
    this.pausedAt = Math.max(0, Math.min(this.pausedAt, this.duration));

    const source = this.graph.createBufferSourceNode(this.audioBuffer);
    source.playbackRate.value = this.playbackRate;
    source.onended = () => this.handleSourceEnded(source);

    this.source = source;
    this.startTime = this.graph.getContext().currentTime - this.pausedAt;
    source.start(0, this.pausedAt);
    this.startTimeUpdates();
  }

  pause(): void {
    if (!this.source) return;

    const source = this.source;
    this.source = null;
    try {
      source.stop();
    } catch {}
    source.disconnect();

    this.pausedAt = Math.max(
      0,
      Math.min(this.getGraphTime() - this.startTime, this.duration),
    );
    this.stopTimeUpdates();
  }

  stop(): void {
    this.resetPlayback();
  }

  seek(time: number): void {
    const wasPlaying = this.timeUpdateInterval !== null;

    if (this.source) {
      this.stopAndClearSource();
    }

    this.pausedAt = Math.max(0, Math.min(time, this.duration));

    if (wasPlaying) {
      void this.play();
    }
  }

  setVolume(volume: number): void {
    this.graph.setVolume(volume);
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = clampRate(rate);
    if (this.source) {
      this.source.playbackRate.value = this.playbackRate;
    }
  }

  getCurrentTime(): number {
    if (!this.source || !this.timeUpdateInterval) {
      return this.pausedAt;
    }
    return Math.max(
      0,
      Math.min(this.getGraphTime() - this.startTime, this.duration),
    );
  }

  getDuration(): number {
    return this.duration;
  }

  getAnalyser(): AnalyserNode | null {
    return this.graph.getAnalyser();
  }

  dispose(): void {
    this.resetPlayback();
    if (this.ownsGraph) {
      this.graph.dispose();
    }
    super.dispose();
  }

  private resetPlayback(): void {
    if (this.source) {
      this.stopAndClearSource();
    }
    this.pausedAt = 0;
    this.stopTimeUpdates();
  }

  private stopAndClearSource(): void {
    if (!this.source) return;
    const source = this.source;
    this.source = null;
    try {
      source.stop();
    } catch {}
    source.disconnect();
  }

  private handleSourceEnded(source: AudioBufferSourceNode): void {
    if (this.source !== source) return;

    this.source = null;
    this.stopTimeUpdates();
    this.pausedAt = this.duration;
    this.emitEnded();
  }

  private getGraphTime(): number {
    try {
      return this.graph.getContext().currentTime;
    } catch {
      return this.pausedAt;
    }
  }

  private startTimeUpdates(): void {
    if (this.timeUpdateInterval) return;

    this.timeUpdateInterval = window.setInterval(() => {
      this.emitTimeUpdate(this.getCurrentTime());
    }, 100);
  }

  private stopTimeUpdates(): void {
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }
}
