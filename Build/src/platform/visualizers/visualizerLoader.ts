import { createLogger } from "../../helpers/logger";

const logger = createLogger("visualizerLoader");

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

export function getByteFrequencyData(
  analyser: AnalyserNode,
  dataArray: Uint8Array | Float32Array,
): void {
  analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
}

export function getByteTimeDomainData(
  analyser: AnalyserNode,
  dataArray: Uint8Array | Float32Array,
): void {
  analyser.getByteTimeDomainData(dataArray as Uint8Array<ArrayBuffer>);
}

/**
 * Read a single audio sample safely. The SSOT for every indexed read of the
 * analyser buffer: out-of-range or undefined reads (noUncheckedIndexedAccess)
 * and injected NaN/Infinity values all collapse to 0. Visualizers must use
 * this instead of raw `buffer[i]` reads so the div-by-zero/NaN class of draw
 * bugs stays impossible to reintroduce.
 */
export function sample(
  dataArray: Uint8Array | Float32Array,
  index: number,
): number {
  const value = dataArray[index];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

export function clearVisualizerState(key?: string) {
  if (key) {
    const state = visualizerStates.get(key);
    if (state) {
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
      visualizerStates.delete(key);
    }
  } else {
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

const loadedVisualizers: Map<string, VisualizerType> = new Map();
const MAX_CACHED_VISUALIZERS = 5;

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
        if (loadedVisualizers.size >= MAX_CACHED_VISUALIZERS) {
          const firstKey = loadedVisualizers.keys().next().value;
          if (firstKey) {
            loadedVisualizers.delete(firstKey);
            clearVisualizerState(firstKey);
            logger.debug(`Evicted visualizer from cache: ${firstKey}`);
          }
        }
        loadedVisualizers.set(key, visualizer);
        return visualizer;
      }
    } catch (error) {
      logger.error(`Failed to load visualizer ${key}:`, {
        state: { error: String(error) },
      });
    }
  }

  return null;
}

export function getAvailableVisualizers(): string[] {
  return Object.keys(visualizerModules)
    .map((path) => path.split("/").pop()?.replace(".visualizer.tsx", ""))
    .filter(Boolean) as string[];
}

export const spectrogramTypes: SpectrogramTypes = {};

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
