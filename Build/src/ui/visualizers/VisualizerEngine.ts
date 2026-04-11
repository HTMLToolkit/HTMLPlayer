import type {
  VisualizerType,
  VisualizerState,
  VisualizerConfig,
} from "./types";
import { VisualizerEvents } from "./events";

const VISUALIZER_STORAGE_KEY = "selected-visualizer";

const visualizerModules = import.meta.glob("../../resources/visualizers/*.tsx");

export class VisualizerEngine {
  private events: VisualizerEvents;
  private loadedVisualizers: Map<string, VisualizerType> = new Map();
  private visualizerStates: Map<string, VisualizerState> = new Map();
  private currentKey: string | null = null;
  private config: VisualizerConfig;

  constructor(events: VisualizerEvents, config?: Partial<VisualizerConfig>) {
    this.events = events;
    this.config = {
      defaultKey: config?.defaultKey || "oceanwaves",
      maxCached: config?.maxCached || 5,
    };
  }

  async loadAvailable(): Promise<string[]> {
    return Object.keys(visualizerModules)
      .map((path) => path.split("/").pop()?.replace(".visualizer.tsx", ""))
      .filter(Boolean) as string[];
  }

  async load(key: string): Promise<VisualizerType | null> {
    if (this.loadedVisualizers.has(key)) {
      return this.loadedVisualizers.get(key)!;
    }

    const path = `../../resources/visualizers/${key}.visualizer.tsx`;
    const moduleLoader = visualizerModules[path];

    if (!moduleLoader) {
      this.events.emit("error", { error: `Visualizer not found: ${key}` });
      return null;
    }

    try {
      const module = await moduleLoader();
      const visualizer = (module as { default: VisualizerType }).default;

      if (!visualizer) {
        this.events.emit("error", { error: `Invalid visualizer: ${key}` });
        return null;
      }

      if (this.loadedVisualizers.size >= this.config.maxCached) {
        const firstKey = this.loadedVisualizers.keys().next().value;
        if (firstKey) {
          this.loadedVisualizers.delete(firstKey);
          this.clearState(firstKey);
        }
      }

      this.loadedVisualizers.set(key, visualizer);
      this.events.emit("load", { key });
      return visualizer;
    } catch (error) {
      this.events.emit("error", { error: (error as Error).message });
      return null;
    }
  }

  async apply(key: string): Promise<void> {
    const visualizer = await this.load(key);
    if (visualizer) {
      this.currentKey = key;
      localStorage.setItem(VISUALIZER_STORAGE_KEY, key);
      this.events.emit("change", { key });
    }
  }

  getCurrent(): VisualizerType | null {
    if (!this.currentKey) return null;
    return this.loadedVisualizers.get(this.currentKey) || null;
  }

  getCurrentKey(): string | null {
    return this.currentKey;
  }

  getState(key: string): VisualizerState | undefined {
    return this.visualizerStates.get(key);
  }

  setState(key: string, state: VisualizerState): void {
    this.visualizerStates.set(key, state);
  }

  clearState(key?: string): void {
    if (key) {
      const state = this.visualizerStates.get(key);
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
        this.visualizerStates.delete(key);
      }
    } else {
      for (const [, state] of this.visualizerStates.entries()) {
        if (state.offscreen) {
          state.offscreen.width = 0;
          state.offscreen.height = 0;
          state.offscreenCtx = null;
        }
        if (state.points) state.points.length = 0;
        if (state.particles) state.particles.length = 0;
      }
      this.visualizerStates.clear();
    }
  }

  getStored(): string | null {
    return localStorage.getItem(VISUALIZER_STORAGE_KEY);
  }

  async initialize(): Promise<void> {
    const stored = this.getStored();
    const key = stored || this.config.defaultKey;
    await this.apply(key);
  }

  reset(): void {
    this.clearState();
    this.loadedVisualizers.clear();
    this.currentKey = null;
    localStorage.removeItem(VISUALIZER_STORAGE_KEY);
  }
}
