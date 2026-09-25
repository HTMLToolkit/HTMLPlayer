import { BufferSourceBackend } from "./BufferSourceBackend";
import { AudioGraph } from "../graph";

export class WebAudioBackend extends BufferSourceBackend {
  constructor(graph?: AudioGraph) {
    super(graph);
  }

  protected async decode(
    url: string,
    context: AudioContext,
  ): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return context.decodeAudioData(arrayBuffer);
  }
}

export function createWebAudioBackend(): WebAudioBackend {
  return new WebAudioBackend();
}