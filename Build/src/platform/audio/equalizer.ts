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

export const EQUALIZER_FREQUENCIES = [
  32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
];

const MIN_GAIN_DB = -12;
const MAX_GAIN_DB = 12;

export class Equalizer {
  private filterNodes: BiquadFilterNode[] = [];
  private currentGains: number[] = EQUALIZER_FREQUENCIES.map(() => 0);
  private enabled = false;

  get nodes(): BiquadFilterNode[] {
    return [...this.filterNodes];
  }

  isBuilt(): boolean {
    return this.filterNodes.length === EQUALIZER_FREQUENCIES.length;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  build(context: AudioContext): void {
    if (this.filterNodes.length > 0) return;

    this.filterNodes = EQUALIZER_FREQUENCIES.map((freq, i) => {
      const filter = context.createBiquadFilter();

      if (i === 0) {
        filter.type = "lowshelf";
      } else if (i === EQUALIZER_FREQUENCIES.length - 1) {
        filter.type = "highshelf";
      } else {
        filter.type = "peaking";
        filter.Q.value = 1;
      }

      filter.frequency.value = freq;
      filter.gain.value = this.currentGains[i] ?? 0;

      return filter;
    });
  }

  disconnect(): void {
    this.filterNodes.forEach((filter) => filter.disconnect());
  }

  setGain(index: number, gain: number): void {
    if (index < 0 || index >= this.filterNodes.length) return;

    const clampedGain = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, gain));
    this.currentGains[index] = clampedGain;
    const filter = this.filterNodes[index];
    if (filter) {
      filter.gain.value = clampedGain;
    }
  }

  setGainUnbuilt(index: number, gain: number): void {
    if (index < 0 || index >= this.currentGains.length) return;
    this.currentGains[index] = Math.max(
      MIN_GAIN_DB,
      Math.min(MAX_GAIN_DB, gain),
    );
  }

  getGain(index: number): number {
    return this.currentGains[index] || 0;
  }

  getGains(): number[] {
    return [...this.currentGains];
  }

  setPreset(preset: EqualizerPreset): void {
    preset.gains.forEach((gain, i) => {
      this.setGainUnbuilt(i, gain);
      const filter = this.filterNodes[i];
      if (filter) {
        filter.gain.value = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, gain));
      }
    });
  }

  setFlat(): void {
    const flat = EQUALIZER_PRESETS[0];
    if (flat) {
      this.setPreset(flat);
    }
  }

  getFrequencies(): number[] {
    return [...EQUALIZER_FREQUENCIES];
  }

  getPresets(): EqualizerPreset[] {
    return [...EQUALIZER_PRESETS];
  }
}

export function createEqualizer(): Equalizer {
  return new Equalizer();
}