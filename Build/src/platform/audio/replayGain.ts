import type { ReplayGainInfo } from "../../core/engine/types";

export interface ReplayGainConfig {
  preampGain: number;
  defaultGain: number;
  normalizeThreshold: number;
  mode: "track" | "album" | "auto";
}

const DEFAULT_CONFIG: ReplayGainConfig = {
  preampGain: 0,
  defaultGain: -18,
  normalizeThreshold: 0.5,
  mode: "auto",
};

export class ReplayGainAnalyzer {
  private config: ReplayGainConfig = DEFAULT_CONFIG;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;

  constructor(config?: Partial<ReplayGainConfig>) {
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }
  }

  async analyzeFromUrl(url: string): Promise<ReplayGainInfo | null> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return this.analyzeFromArrayBuffer(arrayBuffer);
    } catch (error) {
      console.error("ReplayGain analysis failed:", error);
      return null;
    }
  }

  async analyzeFromArrayBuffer(
    buffer: ArrayBuffer,
  ): Promise<ReplayGainInfo | null> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const audioBuffer = await this.audioContext.decodeAudioData(
        buffer.slice(0),
      );
      const samples = audioBuffer.getChannelData(0);

      const rms = this.calculateRMS(samples);
      const peak = this.calculatePeak(samples);

      const db = 20 * Math.log10(rms);
      const gain = this.config.defaultGain - db;

      return {
        trackGain: gain,
        trackPeak: peak,
        referenceLoudness: this.config.defaultGain,
      };
    } catch (error) {
      console.error("ReplayGain analysis error:", error);
      return null;
    }
  }

  private calculateRMS(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  private calculatePeak(samples: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  calculateVolume(replayGain: ReplayGainInfo | undefined): number {
    if (!replayGain?.trackGain) {
      return 1;
    }

    const gain = replayGain.trackGain + this.config.preampGain;
    return Math.pow(10, gain / 20);
  }

  createGainNode(
    context: AudioContext,
    source: AudioBufferSourceNode,
  ): GainNode {
    this.gainNode = context.createGain();
    source.connect(this.gainNode);
    return this.gainNode;
  }

  applyGain(gainNode: GainNode, replayGain: ReplayGainInfo | undefined): void {
    const volume = this.calculateVolume(replayGain);
    gainNode.gain.value = volume;
  }

  setPreampGain(gain: number): void {
    this.config.preampGain = gain;
  }

  getConfig(): ReplayGainConfig {
    return { ...this.config };
  }

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.gainNode = null;
  }
}

export function createReplayGainAnalyzer(
  config?: Partial<ReplayGainConfig>,
): ReplayGainAnalyzer {
  return new ReplayGainAnalyzer(config);
}

export function parseReplayGainTags(
  tags: Record<string, string>,
): ReplayGainInfo | null {
  const result: ReplayGainInfo = {};

  const trackGain = tags["REPLAYGAIN_TRACK_GAIN"];
  if (trackGain) {
    const match = trackGain.match(/([-+]?[\d.]+)\s*dB/i);
    if (match) result.trackGain = parseFloat(match[1]);
  }

  const trackPeak = tags["REPLAYGAIN_TRACK_PEAK"];
  if (trackPeak) {
    result.trackPeak = parseFloat(trackPeak);
  }

  const albumGain = tags["REPLAYGAIN_ALBUM_GAIN"];
  if (albumGain) {
    const match = albumGain.match(/([-+]?[\d.]+)\s*dB/i);
    if (match) result.albumGain = parseFloat(match[1]);
  }

  const albumPeak = tags["REPLAYGAIN_ALBUM_PEAK"];
  if (albumPeak) {
    result.albumPeak = parseFloat(albumPeak);
  }

  const refLevel = tags["REPLAYGAIN_REFERENCE_LOUDNESS"];
  if (refLevel) {
    const match = refLevel.match(/([-+]?[\d.]+)\s*dB/i);
    if (match) result.referenceLoudness = parseFloat(match[1]);
  }

  return Object.keys(result).length > 0 ? result : null;
}
