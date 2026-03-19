export interface VisualizerDrawFunction {
  (
    analyser: AnalyserNode,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    bufferLength: number,
    dataArray: Uint8Array | Float32Array,
    dataType: "time" | "frequency",
    settings: Record<string, unknown> | undefined,
  ): void;
}

export interface VisualizerSettingsConfig {
  [key: string]: {
    type: "range" | "color" | "number" | "select";
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    default: unknown;
  };
}

export interface VisualizerType {
  name: string;
  draw: VisualizerDrawFunction;
  dataType: "time" | "frequency";
  settingsConfig?: VisualizerSettingsConfig;
}

export interface VisualizerState {
  points?: { x: number; y: number; color: string; freqIndex: number }[];
  numPoints?: number;
  pixelSize?: number;
  offscreen?: HTMLCanvasElement;
  offscreenCtx?: CanvasRenderingContext2D | null;
  config?: {
    layers?: number;
    sinTable?: Float32Array;
    points?: { x: number; y: number; z: number; perspective: number }[][];
    initialized?: boolean;
  };
  particles?: { x: number; y: number; vx: number; vy: number; life: number }[];
}

export interface VisualizerConfig {
  defaultKey: string;
  maxCached: number;
}
