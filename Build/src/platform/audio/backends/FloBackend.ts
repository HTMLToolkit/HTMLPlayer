import { BufferSourceBackend } from "./BufferSourceBackend";
import { AudioGraph } from "../graph";
import initFlo, { decode as decodeFlo, info as floInfo } from "@audiflo/libflo";

export class FloBackend extends BufferSourceBackend {
  private initPromise: Promise<unknown> | null = null;

  constructor(graph?: AudioGraph) {
    super(graph);
  }

  private ensureInitialized(): Promise<unknown> {
    this.initPromise ??= initFlo();
    return this.initPromise;
  }

  protected async decode(
    url: string,
    context: AudioContext,
  ): Promise<AudioBuffer> {
    await this.ensureInitialized();

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Flo = new Uint8Array(arrayBuffer);

    const decodedSamples = decodeFlo(uint8Flo);
    const fileInfo = floInfo(uint8Flo);

    const channels = fileInfo.channels;
    const sampleRate = fileInfo.sample_rate;
    if (!channels || !sampleRate) {
      throw new Error("flo file is missing channel or sample rate info");
    }

    const frameCount = Math.floor(decodedSamples.length / channels);
    const audioBuffer = context.createBuffer(channels, frameCount, sampleRate);

    for (let ch = 0; ch < channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = decodedSamples[i * channels + ch] ?? 0;
      }
    }

    return audioBuffer;
  }
}

export function createFloBackend(): FloBackend {
  return new FloBackend();
}