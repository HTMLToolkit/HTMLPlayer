import { createLogger } from "../../helpers/logger";

const logger = createLogger("equalizer");

export type EqualizerBandType =
  | "lowshelf"
  | "peaking"
  | "highshelf"
  | "lowpass"
  | "highpass"
  | "bandpass"
  | "notch";

export interface EqualizerBand {
  type: EqualizerBandType;
  frequency: number;
  gainDb: number;
  q: number;
}

export interface EqualizerPreset {
  name: string;
  bands: EqualizerBand[];
}

export interface EqualizerState {
  enabled: boolean;
  presetName: string | null;
  bands: EqualizerBand[];
}

export const MIN_GAIN_DB = -12;
export const MAX_GAIN_DB = 12;
export const MIN_FREQUENCY_HZ = 20;
export const MAX_FREQUENCY_HZ = 20000;
export const MIN_Q = 0.1;
export const MAX_Q = 12;
export const DEFAULT_Q = 1;

export const EQUALIZER_FREQUENCIES = [
  32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;

export const BAND_COUNT = EQUALIZER_FREQUENCIES.length;

const SHELF_BAND_Q = 0.707;

export function createDefaultBands(): EqualizerBand[] {
  return EQUALIZER_FREQUENCIES.map((frequency, index) => {
    if (index === 0) {
      return { type: "lowshelf", frequency, gainDb: 0, q: SHELF_BAND_Q };
    }
    if (index === BAND_COUNT - 1) {
      return { type: "highshelf", frequency, gainDb: 0, q: SHELF_BAND_Q };
    }
    return { type: "peaking", frequency, gainDb: 0, q: DEFAULT_Q };
  });
}

function preset(
  name: string,
  gains: number[],
  frequencies: readonly number[] = EQUALIZER_FREQUENCIES,
): EqualizerPreset {
  return {
    name,
    bands: frequencies.map((frequency, index) => {
      const isFirst = index === 0;
      const isLast = index === frequencies.length - 1;
      return {
        type: isFirst
          ? ("lowshelf" as const)
          : isLast
            ? ("highshelf" as const)
            : ("peaking" as const),
        frequency,
        gainDb: gains[index] ?? 0,
        q: isFirst || isLast ? SHELF_BAND_Q : DEFAULT_Q,
      };
    }),
  };
}

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  preset("Flat", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  preset("Bass Boost", [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]),
  preset("Treble Boost", [0, 0, 0, 0, 0, 2, 4, 5, 6, 6]),
  preset("Vocal", [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2]),
  preset("Rock", [5, 4, 2, 0, -1, 0, 2, 4, 5, 5]),
  preset("Jazz", [3, 2, 1, 2, -1, -1, 0, 1, 2, 3]),
  preset("Classical", [4, 3, 2, 1, 0, 0, 0, 1, 2, 3]),
  preset("Electronic", [5, 4, 1, 0, -2, -1, 0, 2, 4, 5]),
  preset("Hip Hop", [6, 5, 3, 1, -1, -1, 0, 2, 3, 4]),
  preset("Pop", [-1, 0, 2, 4, 5, 5, 4, 2, 0, -1]),
];

export const FLAT_PRESET_NAME = "Flat";

export function findPreset(name: string): EqualizerPreset | undefined {
  return EQUALIZER_PRESETS.find((candidate) => candidate.name === name);
}

export function createInitialEqualizerState(): EqualizerState {
  return {
    enabled: false,
    presetName: FLAT_PRESET_NAME,
    bands: createDefaultBands(),
  };
}

const BAND_TYPES: readonly EqualizerBandType[] = [
  "lowshelf",
  "peaking",
  "highshelf",
  "lowpass",
  "highpass",
  "bandpass",
  "notch",
];

const PRESET_NAMES = new Set(EQUALIZER_PRESETS.map((preset) => preset.name));

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function sanitizeBand(raw: unknown, fallback: EqualizerBand): EqualizerBand {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  const type = candidate.type;
  const frequency = toFiniteNumber(candidate.frequency);
  const gainDb = toFiniteNumber(candidate.gainDb);
  const q = toFiniteNumber(candidate.q);

  return clampBand({
    type: BAND_TYPES.includes(type as EqualizerBandType)
      ? (type as EqualizerBandType)
      : fallback.type,
    frequency: frequency ?? fallback.frequency,
    gainDb: gainDb ?? fallback.gainDb,
    q: q ?? fallback.q,
  });
}

export function sanitizeEqualizerState(raw: unknown): EqualizerState | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;

  const candidate = raw as Record<string, unknown>;
  if (!Array.isArray(candidate.bands)) return null;
  if (candidate.bands.length !== BAND_COUNT) return null;

  const defaults = createDefaultBands();
  const bands = candidate.bands.map((band, index) =>
    sanitizeBand(band, defaults[index] as EqualizerBand),
  );

  const presetName =
    typeof candidate.presetName === "string" &&
    PRESET_NAMES.has(candidate.presetName)
      ? candidate.presetName
      : null;

  return {
    enabled: candidate.enabled === true,
    presetName,
    bands,
  };
}

export function clampGainDb(gainDb: number): number {
  if (!Number.isFinite(gainDb)) return 0;
  return Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, gainDb));
}

export function clampFrequency(frequency: number): number {
  if (!Number.isFinite(frequency)) return MIN_FREQUENCY_HZ;
  return Math.max(MIN_FREQUENCY_HZ, Math.min(MAX_FREQUENCY_HZ, frequency));
}

export function clampQ(q: number): number {
  if (!Number.isFinite(q)) return DEFAULT_Q;
  return Math.max(MIN_Q, Math.min(MAX_Q, q));
}

export function clampBand(band: EqualizerBand): EqualizerBand {
  return {
    type: band.type,
    frequency: clampFrequency(band.frequency),
    gainDb: clampGainDb(band.gainDb),
    q: clampQ(band.q),
  };
}

export function headroomDb(bands: EqualizerBand[]): number {
  return bands.reduce(
    (max, band) => (band.gainDb > max ? band.gainDb : max),
    0,
  );
}

export class Equalizer {
  private bands: EqualizerBand[] = createDefaultBands();
  private filterNodes: BiquadFilterNode[] = [];
  private enabled = false;

  isBuilt(): boolean {
    return this.filterNodes.length === this.bands.length;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get nodes(): BiquadFilterNode[] {
    return [...this.filterNodes];
  }

  build(context: AudioContext): void {
    if (this.filterNodes.length > 0) {
      this.applyToNodes();
      return;
    }

    try {
      this.filterNodes = this.bands.map((band) => {
        const filter = context.createBiquadFilter();
        this.applyBandToNode(filter, band);
        return filter;
      });
    } catch (error) {
      logger.warn("Failed to build equalizer chain", { error: String(error) });
      this.filterNodes = [];
    }
  }

  disconnect(): void {
    this.filterNodes.forEach((filter) => {
      try {
        filter.disconnect();
      } catch (error) {
        logger.warn("Failed to disconnect equalizer band", {
          error: String(error),
        });
      }
    });
  }

  getBands(): EqualizerBand[] {
    return this.bands.map((band) => ({ ...band }));
  }

  getBand(index: number): EqualizerBand | null {
    const band = this.bands[index];
    return band ? { ...band } : null;
  }

  getFrequencies(): number[] {
    return this.bands.map((band) => band.frequency);
  }

  getGains(): number[] {
    return this.bands.map((band) => band.gainDb);
  }

  getGain(index: number): number {
    return this.bands[index]?.gainDb ?? 0;
  }

  getHeadroomDb(): number {
    return headroomDb(this.bands);
  }

  setBand(index: number, patch: Partial<EqualizerBand>): void {
    const current = this.bands[index];
    if (!current) return;

    const next = clampBand({ ...current, ...patch });
    this.bands[index] = next;

    const node = this.filterNodes[index];
    if (node) this.applyBandToNode(node, next);
  }

  setBandGain(index: number, gainDb: number): void {
    this.setBand(index, { gainDb });
  }

  setBands(bands: EqualizerBand[]): void {
    if (bands.length !== BAND_COUNT) {
      logger.warn("Ignoring band set with unexpected band count", {
        expected: BAND_COUNT,
        received: bands.length,
      });
      return;
    }

    this.bands = bands.map(clampBand);
    this.applyToNodes();
  }

  setPreset(preset: EqualizerPreset): void {
    this.setBands(preset.bands);
  }

  setFlat(): void {
    this.setBands(createDefaultBands());
  }

  reset(): void {
    this.setBands(createDefaultBands());
    this.enabled = false;
  }

  getPresets(): EqualizerPreset[] {
    return EQUALIZER_PRESETS.map((candidate) => ({
      name: candidate.name,
      bands: candidate.bands.map((band) => ({ ...band })),
    }));
  }

  private applyToNodes(): void {
    this.bands.forEach((band, index) => {
      const node = this.filterNodes[index];
      if (node) this.applyBandToNode(node, band);
    });
  }

  private applyBandToNode(node: BiquadFilterNode, band: EqualizerBand): void {
    node.type = band.type;
    node.frequency.value = band.frequency;
    node.Q.value = band.q;
    node.gain.value = band.gainDb;
  }
}

export function createEqualizer(): Equalizer {
  return new Equalizer();
}
