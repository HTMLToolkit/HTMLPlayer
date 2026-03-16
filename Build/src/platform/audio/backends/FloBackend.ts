import { BaseAudioBackend } from "./BaseBackend";

export class FloBackend extends BaseAudioBackend {
  private audioContext: AudioContext | null = null;
  private chain: {
    source: AudioBufferSourceNode | null;
    gainNode: GainNode;
    audioBuffer: AudioBuffer | null;
    startTime: number;
    pausedAt: number;
  };
  private duration = 0;
  private floInitialized = false;
  private floDecoder: typeof import("@flo-audio/libflo-audio") | null = null;
  private timeUpdateInterval: number | null = null;

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
    }
    return this.audioContext;
  }

  private async ensureFloInitialized(): Promise<void> {
    if (this.floInitialized && this.floDecoder) return;

    try {
      const flo = await import("@flo-audio/libflo-audio");
      await flo.default();
      this.floDecoder = flo;
      this.floInitialized = true;
    } catch (error) {
      this.emitError(new Error(`Failed to initialize flo decoder: ${(error as Error).message}`));
    }
  }

  async load(url: string): Promise<void> {
    await this.ensureFloInitialized();
    const ctx = this.ensureContext();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Flo = new Uint8Array(arrayBuffer);

      const decodedSamples = this.floDecoder!.decode(uint8Flo);
      const fileInfo = this.floDecoder!.info(uint8Flo);

      const { channels, sample_rate } = fileInfo;
      const frameCount = decodedSamples.length / channels;

      const audioBuffer = ctx.createBuffer(channels, frameCount, sample_rate);

      for (let ch = 0; ch < channels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = decodedSamples[i * channels + ch];
        }
      }

      this.chain.audioBuffer = audioBuffer;
      this.duration = audioBuffer.duration;
    } catch (error) {
      this.emitError(new Error(`Failed to load flo: ${(error as Error).message}`));
    }
  }

  async play(): Promise<void> {
    if (!this.chain.audioBuffer || !this.audioContext) return;

    if (this.chain.source) {
      try {
        this.chain.source.stop();
      } catch {
        // ignore
      }
    }

    const ctx = this.audioContext;
    const source = ctx.createBufferSource();
    source.buffer = this.chain.audioBuffer;
    source.connect(this.chain.gainNode);
    this.chain.gainNode.connect(ctx.destination);

    source.onended = () => {
      this.stopTimeUpdates();
      this.emitEnded();
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

export function createFloBackend(): FloBackend {
  return new FloBackend();
}