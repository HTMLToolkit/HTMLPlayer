interface VisualizerDrawFunction {
  (
    analyser: AnalyserNode,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    bufferLength: number,
    dataArray: Uint8Array | Float32Array,
    dataType: "time" | "frequency",
    settings: Record<string, any> | undefined,
  ): void;
}

export interface VisualizerType {
  name: string;
  draw: VisualizerDrawFunction;
  dataType: "time" | "frequency";
  settingsConfig?: Record<
    string,
    {
      type: "range" | "color" | "number" | "select";
      min?: number;
      max?: number;
      step?: number;
      options?: string[];
      default: any;
    }
  >;
}

interface SpectrogramTypes {
  [key: string]: VisualizerType;
}

interface VisualizerState {
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

export const visualizerStates: Map<string, VisualizerState> = new Map();

const visualizerModules = import.meta.glob("../visualizers/*.tsx", {
  eager: true,
});

export const spectrogramTypes: SpectrogramTypes = Object.entries(
  visualizerModules
).reduce((acc, [path, module]) => {
  const key = path.split("/").pop()?.replace(".visualizer.tsx", "");
  if (key && (module as any).default) {
    acc[key] = (module as any).default;
  }
  return acc;
}, {} as SpectrogramTypes);
