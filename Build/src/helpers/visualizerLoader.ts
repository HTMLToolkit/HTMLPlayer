interface VisualizerDrawFunction {
  (
    analyser: AnalyserNode,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    bufferLength: number,
    dataArray: Uint8Array | Float32Array,
    dataType: "time" | "frequency",
    settings: Record<string, any> | undefined
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

const visualizerModules = import.meta.glob("../visualizers/*.tsx");

// Cache for loaded visualizers
const loadedVisualizers: Map<string, VisualizerType> = new Map();

// Function to dynamically load a visualizer
export async function loadVisualizer(key: string): Promise<VisualizerType | null> {
  if (loadedVisualizers.has(key)) {
    return loadedVisualizers.get(key)!;
  }

  const path = `../visualizers/${key}.visualizer.tsx`;
  const moduleLoader = visualizerModules[path];
  
  if (moduleLoader) {
    try {
      const module = await moduleLoader();
      const visualizer = (module as any).default;
      if (visualizer) {
        loadedVisualizers.set(key, visualizer);
        return visualizer;
      }
    } catch (error) {
      console.error(`Failed to load visualizer ${key}:`, error);
    }
  }
  
  return null;
}

// Function to get available visualizer keys
export function getAvailableVisualizers(): string[] {
  return Object.keys(visualizerModules).map(path => 
    path.split("/").pop()?.replace(".visualizer.tsx", "")
  ).filter(Boolean) as string[];
}

export const spectrogramTypes: SpectrogramTypes = {
  // This object will be populated dynamically as visualizers are loaded
};

// Function to get a visualizer (loads it if not already loaded)
export async function getVisualizer(key: string): Promise<VisualizerType | null> {
  if (spectrogramTypes[key]) {
    return spectrogramTypes[key];
  }
  
  const visualizer = await loadVisualizer(key);
  if (visualizer) {
    spectrogramTypes[key] = visualizer;
  }
  
  return visualizer;
}
