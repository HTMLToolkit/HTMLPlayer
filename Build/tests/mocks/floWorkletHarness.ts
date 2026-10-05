import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";


export const CONTEXT_RATE = 48000;
export const RENDER_QUANTUM = 128;

export interface WorkletPortMessage {
  type: string;
  paused?: boolean;
  buffered?: number;
  frames?: number;
  cap?: number;
}

export interface WorkletProcessor {
  port: {
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage(message: WorkletPortMessage): void;
  };
  handleMessage(message: unknown): void;
  process(inputs: unknown[], outputs: Float32Array[][]): boolean;
  bufferedFrames: number;
  writeFrame: number;
  readFrame: number;
  playPos: number;
}

class StubAudioWorkletProcessor {
  port: WorkletProcessor["port"];

  constructor() {
    this.port = {
      onmessage: null,
      postMessage: () => undefined,
    };
  }
}

export interface WorkletHarness {
  processor: WorkletProcessor;
  messages: WorkletPortMessage[];
  framesPlayed(): number;
  send(message: unknown): void;
  render(): void;
  renderUntil(predicate: () => boolean, maxRenders?: number): boolean;
  append(frames: number, channels?: number): void;
  configure(channels: number, sampleRate: number): void;
  levels(): WorkletPortMessage[];
}

export const createWorkletHarness = (
  workletPath = resolve(process.cwd(), "src/platform/audio/stream/FloStreamWorklet.js"),
): WorkletHarness => {
  const source = readFileSync(workletPath, "utf8");
  let Registered: (new () => WorkletProcessor) | null = null;
  const sandbox = {
    sampleRate: CONTEXT_RATE,
    AudioWorkletProcessor: StubAudioWorkletProcessor,
    Float32Array,
    registerProcessor: (_name: string, ctor: new () => WorkletProcessor): void => {
      Registered = ctor;
    },
  };
  runInNewContext(source, sandbox);
  if (!Registered) {
    throw new Error("worklet did not register a processor");
  }

  const processor = new Registered();
  const messages: WorkletPortMessage[] = [];
  processor.port.postMessage = (message: WorkletPortMessage): void => {
    messages.push(message);
  };

  const playFramesAt = (): number => Math.floor(processor.playPos);

  return {
    processor,
    messages,
    framesPlayed: playFramesAt,
    send: (message: unknown): void => {
      processor.handleMessage(message);
    },
    render: (): void => {
      processor.process(
        [],
        [
          [new Float32Array(RENDER_QUANTUM), new Float32Array(RENDER_QUANTUM)],
        ],
      );
    },
    renderUntil: (predicate: () => boolean, maxRenders = 100000): boolean => {
      for (let i = 0; i < maxRenders; i += 1) {
        if (predicate()) return true;
        processor.process(
          [],
          [
            [new Float32Array(RENDER_QUANTUM), new Float32Array(RENDER_QUANTUM)],
          ],
        );
      }
      return predicate();
    },
    append: (frames: number, channels = 2): void => {
      processor.handleMessage({
        type: "append",
        data: new Float32Array(frames * channels),
      });
    },
    configure: (channels: number, sampleRate: number): void => {
      processor.handleMessage({
        type: "configure",
        channels,
        sampleRate,
        highWatermarkSeconds: 2,
        lowWatermarkSeconds: 1,
        hardCapSeconds: 8,
      });
    },
    levels: () => messages.filter((m) => m.type === "level"),
  };
};
