export interface EqualizerPreset {
  name: string;
  gains: number[];
}

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  { name: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Bass Boost", gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { name: "Treble Boost", gains: [0, 0, 0, 0, 0, 2, 4, 5, 6, 6] },
  { name: "Vocal", gains: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2] },
  { name: "Rock", gains: [5, 4, 2, 0, -1, 0, 2, 4, 5, 5] },
  { name: "Jazz", gains: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3] },
  { name: "Classical", gains: [4, 3, 2, 1, 0, 0, 0, 1, 2, 3] },
  { name: "Electronic", gains: [5, 4, 1, 0, -2, -1, 0, 2, 4, 5] },
  { name: "Hip Hop", gains: [6, 5, 3, 1, -1, -1, 0, 2, 3, 4] },
  { name: "Pop", gains: [-1, 0, 2, 4, 5, 5, 4, 2, 0, -1] },
];

const EQUALIZER_FREQUENCIES = [
  32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
];

export class Equalizer {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private gainNode: GainNode | null = null;
  private connected = false;
  private enabled = false;
  private currentGains: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  constructor() {}

  connect(audioElement: HTMLAudioElement, audioContext: AudioContext): void {
    if (this.connected) return;

    this.audioContext = audioContext;

    this.sourceNode = audioContext.createMediaElementSource(audioElement);

    this.gainNode = audioContext.createGain();

    this.filters = EQUALIZER_FREQUENCIES.map((freq, i) => {
      const filter = audioContext.createBiquadFilter();

      if (i === 0) {
        filter.type = "lowshelf";
      } else if (i === EQUALIZER_FREQUENCIES.length - 1) {
        filter.type = "highshelf";
      } else {
        filter.type = "peaking";
        filter.Q.value = 1;
      }

      filter.frequency.value = freq;
      filter.gain.value = this.currentGains[i];

      return filter;
    });

    let lastNode: AudioNode = this.sourceNode;
    for (const filter of this.filters) {
      lastNode.connect(filter);
      lastNode = filter;
    }

    lastNode.connect(this.gainNode);
    this.gainNode.connect(audioContext.destination);

    this.connected = true;
  }

  disconnect(): void {
    if (!this.connected) return;

    this.sourceNode?.disconnect();
    this.filters.forEach((f) => f.disconnect());
    this.gainNode?.disconnect();

    this.sourceNode = null;
    this.filters = [];
    this.gainNode = null;
    this.connected = false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.gainNode) {
      this.gainNode.gain.value = enabled ? 1 : 1;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setGain(index: number, gain: number): void {
    if (index < 0 || index >= this.filters.length) return;

    const clampedGain = Math.max(-12, Math.min(12, gain));
    this.currentGains[index] = clampedGain;
    this.filters[index].gain.value = clampedGain;
  }

  getGain(index: number): number {
    return this.currentGains[index] || 0;
  }

  getGains(): number[] {
    return [...this.currentGains];
  }

  setPreset(preset: EqualizerPreset): void {
    preset.gains.forEach((gain, i) => {
      this.setGain(i, gain);
    });
  }

  setFlat(): void {
    this.setPreset(EQUALIZER_PRESETS[0]);
  }

  getFrequencies(): number[] {
    return [...EQUALIZER_FREQUENCIES];
  }

  getPresets(): EqualizerPreset[] {
    return [...EQUALIZER_PRESETS];
  }

  getAnalyserNode(): AnalyserNode | null {
    if (!this.audioContext || !this.connected) return null;

    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;

    if (this.filters.length > 0) {
      this.filters[this.filters.length - 1].connect(analyser);
    }

    return analyser;
  }

  dispose(): void {
    this.disconnect();
    this.audioContext = null;
  }
}

export function createEqualizer(): Equalizer {
  return new Equalizer();
}
