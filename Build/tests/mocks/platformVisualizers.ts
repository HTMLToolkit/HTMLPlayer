import type { VisualizerType } from "../../src/platform/visualizers";

export function getByteFrequencyData(
  analyser: AnalyserNode,
  dataArray: Uint8Array | Float32Array,
): void {
  analyser.getByteFrequencyData(dataArray as unknown as Uint8Array<ArrayBuffer>);
}

export function getByteTimeDomainData(
  analyser: AnalyserNode,
  dataArray: Uint8Array | Float32Array,
): void {
  analyser.getByteTimeDomainData(dataArray as unknown as Uint8Array<ArrayBuffer>);
}

export function sample(
  dataArray: Uint8Array | Float32Array,
  index: number,
): number {
  const value = dataArray[index];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export const visualizerStates: Map<string, unknown> = new Map();

export function clearVisualizerState(key?: string): void {
  if (key) {
    visualizerStates.delete(key);
  } else {
    visualizerStates.clear();
  }
}

export const spectrogramTypes: Record<string, VisualizerType> = {};

export async function loadVisualizer(_key: string): Promise<VisualizerType | null> {
  return null;
}

export async function getVisualizer(_key: string): Promise<VisualizerType | null> {
  return null;
}

export function getAvailableVisualizers(): string[] {
  return [];
}