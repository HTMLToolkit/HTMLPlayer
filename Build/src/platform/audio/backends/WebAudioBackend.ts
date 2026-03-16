import type { IAudioBackend } from "../index";

interface AudioNodeChain {
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  audioBuffer: AudioBuffer | null;
  startTime: number;
  pausedAt: number;
}

export class WebAudioBackend implements IAudioBackend {
  private audioContext: AudioContext | null = null;
  private chain: AudioNodeChain;
  private isPlaying = false;
  private timeUpdateCallback: ((time: number) => void) | null = null;
  private endedCallback: (() => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private timeUpdateInterval: number | null = null;
  private duration = 0;

  constructor() {
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
    }
    return this.audioContext;
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

    if (this.isPlaying) {
      this.stop();
    }

    const ctx = this.audioContext;
    const source = ctx.createBufferSource();
    source.buffer = this.chain.audioBuffer;
    source.connect(this.chain.gainNode);
    this.chain.gainNode.connect(ctx.destination);

    source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.stopTimeUpdates();
        if (this.endedCallback) {
          this.endedCallback();
        }
      }
    };

    const offset = this.chain.pausedAt;
    this.chain.source = source;
    this.chain.startTime = ctx.currentTime - offset;
    source.start(0, offset);
    this.isPlaying = true;
    this.startTimeUpdates();
  }

  pause(): void {
    if (!this.isPlaying || !this.audioContext || !this.chain.source) return;

    try {
      this.chain.source.stop();
    } catch {}

    this.chain.pausedAt = this.audioContext.currentTime - this.chain.startTime;
    this.isPlaying = false;
    this.stopTimeUpdates();
  }

  stop(): void {
    if (this.chain.source) {
      try {
        this.chain.source.stop();
      } catch {}
      this.chain.source.disconnect();
      this.chain.source = null;
    }

    this.isPlaying = false;
    this.chain.pausedAt = 0;
    this.stopTimeUpdates();
  }

  seek(time: number): void {
    const wasPlaying = this.isPlaying;

    if (this.isPlaying && this.chain.source) {
      try {
        this.chain.source.stop();
      } catch {}
      this.chain.source.disconnect();
      this.chain.source = null;
    }

    this.chain.pausedAt = Math.max(0, Math.min(time, this.duration));
    this.isPlaying = false;

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
    if (!this.audioContext || !this.isPlaying) {
      return this.chain.pausedAt;
    }
    return this.audioContext.currentTime - this.chain.startTime;
  }

  getDuration(): number {
    return this.duration;
  }

  onTimeUpdate(callback: (time: number) => void): void {
    this.timeUpdateCallback = callback;
  }

  onEnded(callback: () => void): void {
    this.endedCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
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

    this.timeUpdateCallback = null;
    this.endedCallback = null;
    this.errorCallback = null;
  }

  private startTimeUpdates(): void {
    if (this.timeUpdateInterval) return;

    this.timeUpdateInterval = window.setInterval(() => {
      if (this.isPlaying && this.timeUpdateCallback) {
        this.timeUpdateCallback(this.getCurrentTime());
      }
    }, 100);
  }

  private stopTimeUpdates(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }
}

export function createWebAudioBackend(): IAudioBackend {
  return new WebAudioBackend();
}