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

// Clean up visualizer state when switching visualizers
export function clearVisualizerState(key?: string) {
  if (key) {
    const state = visualizerStates.get(key);
    if (state) {
      // Clean up offscreen canvas if present
      if (state.offscreen) {
        state.offscreen.width = 0;
        state.offscreen.height = 0;
        state.offscreenCtx = null;
      }
      // Clear arrays
      if (state.points) state.points.length = 0;
      if (state.particles) state.particles.length = 0;
      if (state.config?.points) {
        state.config.points.forEach((arr) => (arr.length = 0));
        state.config.points.length = 0;
      }
      visualizerStates.delete(key);
    }
  } else {
    // Clear all states
    for (const [, state] of visualizerStates.entries()) {
      if (state.offscreen) {
        state.offscreen.width = 0;
        state.offscreen.height = 0;
        state.offscreenCtx = null;
      }
      if (state.points) state.points.length = 0;
      if (state.particles) state.particles.length = 0;
      if (state.config?.points) {
        state.config.points.forEach((arr) => (arr.length = 0));
        state.config.points.length = 0;
      }
    }
    visualizerStates.clear();
  }
}

const visualizerModules = import.meta.glob("../visualizers/*.tsx");

// Cache for loaded visualizers: limit to prevent memory growth
const loadedVisualizers: Map<string, VisualizerType> = new Map();
const MAX_CACHED_VISUALIZERS = 5; // Only keep 5 visualizers in memory

// Function to dynamically load a visualizer
export async function loadVisualizer(
  key: string,
): Promise<VisualizerType | null> {
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
        // Enforce cache limit to prevent memory growth
        if (loadedVisualizers.size >= MAX_CACHED_VISUALIZERS) {
          // Remove oldest entry (first in Map)
          const firstKey = loadedVisualizers.keys().next().value;
          if (firstKey) {
            loadedVisualizers.delete(firstKey);
            clearVisualizerState(firstKey);
            console.log(`Evicted visualizer from cache: ${firstKey}`);
          }
        }
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
  return Object.keys(visualizerModules)
    .map((path) => path.split("/").pop()?.replace(".visualizer.tsx", ""))
    .filter(Boolean) as string[];
}

export const spectrogramTypes: SpectrogramTypes = {
  // This object will be populated dynamically as visualizers are loaded
};

// Function to get a visualizer (loads it if not already loaded)
export async function getVisualizer(
  key: string,
): Promise<VisualizerType | null> {
  if (spectrogramTypes[key]) {
    return spectrogramTypes[key];
  }

  const visualizer = await loadVisualizer(key);
  if (visualizer) {
    spectrogramTypes[key] = visualizer;
  }

  return visualizer;
}
