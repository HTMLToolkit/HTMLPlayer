import { BaseAudioBackend } from "./BaseBackend";

export class WebAudioBackend extends BaseAudioBackend {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private chain: {
    source: AudioBufferSourceNode | null;
    gainNode: GainNode;
    audioBuffer: AudioBuffer | null;
    startTime: number;
    pausedAt: number;
  };
  private timeUpdateInterval: number | null = null;
  private duration = 0;

  constructor() {
    super();
    this.chain = {
      source: null,
      gainNode: this.createGainNode(),
      audioBuffer: null,
      startTime: 0,
      pausedAt: 0,
    };
  }

  private createGainNode(): GainNode {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext.createGain();
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.chain.gainNode = this.audioContext.createGain();
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
    }
    return this.audioContext;
  }

  getAnalyser(): AnalyserNode | null {
    this.ensureContext();
    return this.analyserNode;
  }

  private ensureAnalyser(): AnalyserNode {
    if (!this.analyserNode) {
      this.analyserNode = this.audioContext!.createAnalyser();
      this.analyserNode.fftSize = 2048;
    }
    return this.analyserNode;
  }

  async load(url: string): Promise<void> {
    const ctx = this.ensureContext();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      this.chain.audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.duration = this.chain.audioBuffer.duration;
    } catch (error) {
      throw new Error(`Failed to load audio: ${(error as Error).message}`);
    }
  }

  async play(): Promise<void> {
    if (!this.chain.audioBuffer || !this.audioContext) return;

    if (this.timeUpdateInterval) {
      this.stop();
    }

    const ctx = this.audioContext;
    const source = ctx.createBufferSource();
    source.buffer = this.chain.audioBuffer;
    source.connect(this.chain.gainNode);

    const analyser = this.ensureAnalyser();
    this.chain.gainNode.connect(analyser);
    analyser.connect(ctx.destination);

    source.onended = () => {
      if (this.timeUpdateInterval) {
        this.stopTimeUpdates();
        this.emitEnded();
      }
    };

    const offset = this.chain.pausedAt;
    this.chain.source = source;
    this.chain.startTime = ctx.currentTime - offset;
    source.start(0, offset);
    this.startTimeUpdates();
  }

  pause(): void {
    if (!this.audioContext || !this.chain.source) return;

    try {
      this.chain.source.stop();
    } catch {
      // ignore
    }

    this.chain.pausedAt = this.audioContext.currentTime - this.chain.startTime;
    this.stopTimeUpdates();
  }

  stop(): void {
    if (this.chain.source) {
      try {
        this.chain.source.stop();
      } catch {
        // ignore
      }
      this.chain.source.disconnect();
      this.chain.source = null;
    }

    this.chain.pausedAt = 0;
    this.stopTimeUpdates();
  }

  seek(time: number): void {
    const wasPlaying = this.timeUpdateInterval !== null;

    if (this.chain.source) {
      try {
        this.chain.source.stop();
      } catch {
        // ignore
      }
      this.chain.source.disconnect();
      this.chain.source = null;
    }

    this.chain.pausedAt = Math.max(0, Math.min(time, this.duration));

    if (wasPlaying) {
      this.play();
    }
  }

  setVolume(volume: number): void {
    this.chain.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  setPlaybackRate(rate: number): void {
    if (this.chain.source) {
      this.chain.source.playbackRate.value = Math.max(0.25, Math.min(4, rate));
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.timeUpdateInterval) {
      return this.chain.pausedAt;
    }
    return this.audioContext.currentTime - this.chain.startTime;
  }

  getDuration(): number {
    return this.duration;
  }

  dispose(): void {
    this.stop();
    this.stopTimeUpdates();

    if (this.chain.gainNode) {
      this.chain.gainNode.disconnect();
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private startTimeUpdates(): void {
    if (this.timeUpdateInterval) return;

    this.timeUpdateInterval = window.setInterval(() => {
      this.emitTimeUpdate(this.getCurrentTime());
    }, 100);
  }

  private stopTimeUpdates(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }
}

export function createWebAudioBackend(): WebAudioBackend {
  return new WebAudioBackend();
}
