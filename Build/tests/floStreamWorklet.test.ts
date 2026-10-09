import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const WORKLET_PATH = resolve(
  __dirname,
  "../src/platform/audio/stream/FloStreamWorklet.js",
);

const WORKLET_SOURCE = readFileSync(WORKLET_PATH, "utf8");

const CONTEXT_RATE = 48000;
const CHANNELS = 2;
const RENDER_QUANTUM = 128;
const HIGH_WATERMARK_SECONDS = 2;
const LOW_WATERMARK_SECONDS = 1;
const HARD_CAP_SECONDS = 8;
const MEASURED_BURST_SECONDS = 6;

interface PortMessage {
  type: string;
  paused?: boolean;
  frames?: number;
  cap?: number;
}

interface WorkletProcessor {
  port: {
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage(message: PortMessage): void;
  };
  handleMessage(message: unknown): void;
  process(
    inputs: unknown[],
    outputs: Float32Array[][],
  ): boolean;
  bufferedFrames: number;
  data: Float32Array;
  capacity: number;
  writeFrame: number;
  readFrame: number;
  playPos: number;
  hardCapFrames: number;
  highWatermarkFrames: number;
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

interface Harness {
  processor: WorkletProcessor;
  messages: PortMessage[];
  send(message: unknown): void;
  render(): void;
  fill(frames: number): void;
  configure(sampleRate: number): void;
}

const createHarness = (): Harness => {
  let Registered: (new () => WorkletProcessor) | null = null;
  const sandbox = {
    sampleRate: CONTEXT_RATE,
    AudioWorkletProcessor: StubAudioWorkletProcessor,
    Float32Array,
    registerProcessor: (_name: string, ctor: new () => WorkletProcessor): void => {
      Registered = ctor;
    },
  };
  runInNewContext(WORKLET_SOURCE, sandbox);
  if (!Registered) {
    throw new Error("worklet did not register a processor");
  }

  const processor = new Registered();
  const messages: PortMessage[] = [];
  processor.port.postMessage = (message: PortMessage): void => {
    messages.push(message);
  };

  const send = (message: unknown): void => {
    processor.handleMessage(message);
  };

  return {
    processor,
    messages,
    send,
    configure: (sampleRate: number): void => {
      send({ type: "configure", channels: CHANNELS, sampleRate });
    },
    fill: (frames: number): void => {
      send({
        type: "append",
        data: new Float32Array(frames * CHANNELS).fill(0.25),
      });
    },
    render: (): void => {
      processor.process(
        [],
        [
          [new Float32Array(RENDER_QUANTUM), new Float32Array(RENDER_QUANTUM)],
        ],
      );
    },
  };
};

const secondsToFrames = (seconds: number, sampleRate: number): number =>
  Math.round(seconds * sampleRate);

const levelSignals = (harness: Harness): (boolean | undefined)[] =>
  harness.messages
    .filter((m) => m.type === "level")
    .map((m) => m.paused);

const blocksToExceed = (): number => {
  const blockSeconds = 0.5;
  return Math.ceil(HARD_CAP_SECONDS / blockSeconds) + 4;
};

describe("FloStreamWorklet backpressure", () => {
  it("keeps the hard cap above the pause watermark and the decoder burst", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);

    expect(harness.processor.hardCapFrames).toBe(
      secondsToFrames(HARD_CAP_SECONDS, CONTEXT_RATE),
    );
    expect(harness.processor.highWatermarkFrames).toBe(
      secondsToFrames(HIGH_WATERMARK_SECONDS, CONTEXT_RATE),
    );
    expect(harness.processor.hardCapFrames).toBeGreaterThan(
      secondsToFrames(HIGH_WATERMARK_SECONDS, CONTEXT_RATE),
    );
    expect(harness.processor.hardCapFrames).toBeGreaterThan(
      secondsToFrames(MEASURED_BURST_SECONDS, CONTEXT_RATE),
    );
  });

  it("signals a full ring while stopped instead of waiting for playback", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);

    harness.fill(secondsToFrames(HIGH_WATERMARK_SECONDS, CONTEXT_RATE));
    harness.render();

    expect(levelSignals(harness)).toEqual([true]);
    expect(harness.processor.bufferedFrames).toBe(
      secondsToFrames(HIGH_WATERMARK_SECONDS, CONTEXT_RATE),
    );
  });

  it("does not drain the ring while stopped", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);
    const frames = secondsToFrames(1, CONTEXT_RATE);

    harness.fill(frames);
    for (let i = 0; i < 8; i++) harness.render();

    expect(harness.processor.readFrame).toBe(0);
    expect(harness.processor.bufferedFrames).toBe(frames);
  });

  it("reports overflow once instead of on every append past the cap", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);

    const block = secondsToFrames(0.5, CONTEXT_RATE);
    const blocks = blocksToExceed();
    for (let i = 0; i < blocks; i++) harness.fill(block);
    harness.render();

    const overflows = harness.messages.filter((m) => m.type === "overflow");
    expect(overflows).toHaveLength(1);
    expect(overflows[0]!.cap).toBe(
      secondsToFrames(HARD_CAP_SECONDS, CONTEXT_RATE),
    );
    expect(overflows[0]!.frames).toBeGreaterThan(overflows[0]!.cap!);
  });

  it("allows a fresh overflow report after the ring drains under the cap", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);
    const block = secondsToFrames(0.5, CONTEXT_RATE);
    const blocks = blocksToExceed();

    for (let i = 0; i < blocks; i++) harness.fill(block);
    harness.render();
    expect(harness.messages.filter((m) => m.type === "overflow")).toHaveLength(
      1,
    );

    harness.send({ type: "flush" });
    for (let i = 0; i < blocks; i++) harness.fill(block);
    harness.render();

    expect(harness.messages.filter((m) => m.type === "overflow")).toHaveLength(
      2,
    );
  });

  it("reports the ring depth with every level message", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);

    harness.fill(secondsToFrames(HIGH_WATERMARK_SECONDS, CONTEXT_RATE));
    harness.render();

    const high = harness.messages.find((m) => m.type === "level");
    expect(high?.buffered).toBe(
      secondsToFrames(HIGH_WATERMARK_SECONDS, CONTEXT_RATE),
    );

    harness.send({ type: "play", rate: 1 });
    for (let i = 0; i < 2000; i += 1) {
      const before = harness.messages.length;
      harness.render();
      for (const message of harness.messages.slice(before)) {
        if (message.type !== "level") continue;
        expect(message.buffered).toBe(harness.processor.bufferedFrames);
      }
    }
  });

  it("releases the pause signal once playback drains to the low watermark", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);
    harness.fill(secondsToFrames(2.5, CONTEXT_RATE));
    harness.render();

    expect(levelSignals(harness)).toEqual([true]);

    harness.send({ type: "play", rate: 1 });
    const lowWatermark = secondsToFrames(LOW_WATERMARK_SECONDS, CONTEXT_RATE);
    for (let i = 0; i < 2000; i++) {
      if (harness.processor.bufferedFrames <= lowWatermark) break;
      harness.render();
    }

    expect(levelSignals(harness)).toEqual([true, false]);
    expect(harness.processor.bufferedFrames).toBeLessThanOrEqual(lowWatermark);
  });

  it("preserves sample data when the ring wraps and then grows", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);

    const blockFrames = 2048;
    const totalFrames = blockFrames * 24;
    const expected = new Float32Array(totalFrames * CHANNELS);
    for (let f = 0; f < totalFrames; f++) {
      expected[f * CHANNELS] = f / CHANNELS;
      expected[f * CHANNELS + 1] = -(f / CHANNELS) - 1;
    }

    let written = 0;
    const appendBlock = (): void => {
      harness.send({
        type: "append",
        data: expected.slice(
          written * CHANNELS,
          (written + blockFrames) * CHANNELS,
        ),
      });
      written += blockFrames;
    };

    for (let b = 0; b < 8; b++) appendBlock();

    harness.send({ type: "play", rate: 1 });
    for (let i = 0; i < 64; i++) harness.render();
    harness.send({ type: "pause" });
    const readHead = harness.processor.readFrame;
    expect(readHead).toBeGreaterThan(0);

    for (let b = 0; b < 16; b++) appendBlock();
    expect(harness.processor.capacity).toBeGreaterThan(16384);
    expect(harness.processor.bufferedFrames).toBeGreaterThan(16384);

    harness.send({ type: "play", rate: 1 });
    let pos = Math.floor(harness.processor.playPos);
    while (pos < totalFrames - 1) {
      const out = [new Float32Array(RENDER_QUANTUM), new Float32Array(RENDER_QUANTUM)];
      harness.processor.process([], [out]);
      for (let i = 0; i < RENDER_QUANTUM; i++) {
        if (pos >= totalFrames - 1) break;
        expect(out[0]![i]).toBeCloseTo(pos / CHANNELS, 3);
        expect(out[1]![i]).toBeCloseTo(-(pos / CHANNELS) - 1, 3);
        pos++;
      }
    }
    expect(pos).toBe(totalFrames - 1);
  });
});

describe("FloStreamWorklet end of track", () => {
  const renderUntilEmpty = (harness: Harness, frames: number): void => {
    const quanta = Math.ceil(frames / RENDER_QUANTUM) + 8;
    for (let i = 0; i < quanta; i++) harness.render();
  };

  it("does not end the track when the ring runs dry before the stream completes", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);
    harness.fill(secondsToFrames(0.5, CONTEXT_RATE));
    harness.send({ type: "play", rate: 1 });

    renderUntilEmpty(harness, secondsToFrames(0.5, CONTEXT_RATE));

    expect(harness.processor.bufferedFrames).toBeLessThanOrEqual(1);
    expect(harness.messages.filter((m) => m.type === "ended")).toHaveLength(0);
  });

  it("reports end of track once a completed stream is fully drained", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);
    harness.fill(secondsToFrames(0.5, CONTEXT_RATE));
    harness.send({ type: "endOfStream" });
    harness.send({ type: "play", rate: 1 });

    renderUntilEmpty(harness, secondsToFrames(0.5, CONTEXT_RATE));

    const ended = harness.messages.filter((m) => m.type === "ended");
    expect(ended).toHaveLength(1);
  });

  it("ends the track even when the last append lands short of a full frame", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);
    harness.fill(3);
    harness.send({ type: "endOfStream" });
    harness.send({ type: "play", rate: 1 });

    for (let i = 0; i < 8; i++) harness.render();

    expect(harness.messages.filter((m) => m.type === "ended")).toHaveLength(1);
  });

  it("stays silent instead of ending when playback starts with an empty ring", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);
    harness.send({ type: "play", rate: 1 });

    for (let i = 0; i < 32; i++) harness.render();

    expect(harness.messages.filter((m) => m.type === "ended")).toHaveLength(0);
  });

  it("ends a completed stream only once across repeated drains", () => {
    const harness = createHarness();
    harness.configure(CONTEXT_RATE);
    harness.fill(secondsToFrames(0.25, CONTEXT_RATE));
    harness.send({ type: "endOfStream" });
    harness.send({ type: "play", rate: 1 });

    renderUntilEmpty(harness, secondsToFrames(0.25, CONTEXT_RATE));
    for (let i = 0; i < 64; i++) harness.render();

    expect(harness.messages.filter((m) => m.type === "ended")).toHaveLength(1);
  });
});
