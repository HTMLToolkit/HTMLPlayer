import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { BackendRouter } from "../../src/platform/audio/backends/BackendRouter";
import { KomorebiEngine } from "../../src/core/engine/engine";
import type { Track, Playlist } from "../../src/core/engine/types";
import type { FloStreamDecoderProtocol } from "../../src/platform/audio/stream/FloStreamPump";
import { FloStreamPump } from "../../src/platform/audio/stream/FloStreamPump";
import { createWorkletHarness } from "../mocks/floWorkletHarness";
import type { WorkletHarness } from "../mocks/floWorkletHarness";


const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAMES_PER_CHUNK = 1024;
const HIGH_WATERMARK_SECONDS = 2;
const HIGH_WATERMARK_FRAMES = HIGH_WATERMARK_SECONDS * SAMPLE_RATE;

const createDecoder = (
  totalSeconds: number,
  options: { reportDuration: boolean } = { reportDuration: true },
): { decoder: FloStreamDecoderProtocol; producedFrames: () => number } => {
  const totalFrames = Math.round(totalSeconds * SAMPLE_RATE);
  let produced = 0;
  let finished = false;

  const decoder: FloStreamDecoderProtocol = {
    feed: () => true,
    get_info: () => ({
      sample_rate: SAMPLE_RATE,
      channels: CHANNELS,
      bit_depth: 16,
      total_samples: options.reportDuration ? BigInt(totalFrames) : 0n,
    }),
    has_error: () => false,
    next_frame: () => {
      if (produced >= totalFrames) {
        finished = true;
        return null;
      }
      const frames = Math.min(FRAMES_PER_CHUNK, totalFrames - produced);
      produced += frames;
      return new Float32Array(frames * CHANNELS).fill(0.5);
    },
    is_finished: () => finished,
    free: () => undefined,
  };

  return { decoder, producedFrames: () => produced };
};

const installFakeWorker = (decoder: FloStreamDecoderProtocol): (() => void) => {
  const globals = globalThis as { Worker?: unknown };
  const original = globals.Worker;
  let pump: FloStreamPump | null = null;

  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;

    postMessage(message: unknown): void {
      const data = message as { type: string; streamId: number; shouldPause?: boolean };

      if (data.type === "start") {
        const streamId = data.streamId;
        pump?.cancel();
        const emit = (payload: unknown): void => this.onmessage?.({ data: payload });

        pump = new FloStreamPump({
          url: "memory://fixture",
          decoder,
          fetcher: async () => ({
            ok: true,
            status: 200,
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array(64));
                controller.close();
              },
            }),
          }),
          events: {
            onInfo: (info) => {
              emit({ type: "info", streamId, info });
            },
            onChunk: (chunk) => {
              emit({ type: "chunk", streamId, data: chunk });
            },
            onEnd: () => {
              emit({ type: "end", streamId });
            },
            onError: (error) => {
              emit({ type: "error", streamId, message: error.message });
            },
          },
        });

        void pump.start(0).catch((error: Error) =>
          emit({ type: "error", streamId, message: error.message }),
        );
      } else if (data.type === "cancel") {
        pump?.cancel();
        pump = null;
      } else if (data.type === "pressure") {
        if (data.shouldPause) pump?.pause();
        else pump?.resume();
      }
    }

    terminate(): void {
      pump?.cancel();
      pump = null;
    }
  }

  globals.Worker = FakeWorker;
  if (typeof window !== "undefined") {
    (window as unknown as { Worker?: unknown }).Worker = FakeWorker;
  }
  return () => {
    globals.Worker = original;
    if (typeof window !== "undefined") {
      (window as unknown as { Worker?: unknown }).Worker = original;
    }
  };
};

const installObjectUrls = (): (() => void) => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let issued = 0;

  URL.createObjectURL = ((): string => `blob:fixture-${(issued += 1)}`) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((): void => undefined) as typeof URL.revokeObjectURL;

  return () => {
    if (originalCreate === undefined) delete (URL as { createObjectURL?: unknown }).createObjectURL;
    else URL.createObjectURL = originalCreate;
    if (originalRevoke === undefined) delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
    else URL.revokeObjectURL = originalRevoke;
  };
};

const installFakeAudio = (worklet: WorkletHarness): (() => void) => {
  const globals = globalThis as Record<string, unknown>;
  const saved = {
    AudioContext: globals.AudioContext,
    AudioWorkletNode: globals.AudioWorkletNode,
    BaseAudioContext: globals.BaseAudioContext,
  };

  class FakeAudioWorkletNode {
    port: {
      onmessage: ((event: { data: unknown }) => void) | null;
      postMessage: (message: unknown) => void;
    };

    constructor() {
      this.port = {
        onmessage: null,
        postMessage: (message: unknown) => worklet.send(message),
      };

      const original = worklet.processor.port.postMessage;
      worklet.processor.port.postMessage = (payload: unknown): void => {
        original(payload);
        this.port.onmessage?.({ data: payload });
      };
    }

    connect(): void {}
    disconnect(): void {}
  }

  const inertNode = (): Record<string, unknown> => ({
    connect: () => undefined,
    disconnect: () => undefined,
    gain: { value: 1 },
    frequency: { value: 350 },
    Q: { value: 1 },
    detune: { value: 0 },
    delayTime: { value: 0 },
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    minDecibels: -100,
    maxDecibels: -30,
    getFloatFrequencyData: (array: Float32Array) => array.fill(0),
    getFloatTimeDomainData: (array: Float32Array) => array.fill(0),
    getByteFrequencyData: (array: Uint8Array) => array.fill(0),
    getByteTimeDomainData: (array: Uint8Array) => array.fill(0),
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
    channelCountMode: "max",
    channelInterpretation: "speakers",
  });

  class FakeAudioContext {
    sampleRate = SAMPLE_RATE;
    state = "running";
    currentTime = 0;
    destination = {};
    audioWorklet = { addModule: async (): Promise<void> => undefined };

    async resume(): Promise<void> {
      this.state = "running";
    }

    async close(): Promise<void> {}
  }

  for (const factory of [
    "createGain",
    "createAnalyser",
    "createBiquadFilter",
    "createDelay",
    "createStereoPanner",
    "createDynamicsCompressor",
    "createWaveShaper",
    "createConvolver",
    "createBufferSource",
  ]) {
    (FakeAudioContext.prototype as unknown as Record<string, unknown>)[factory] = inertNode;
  }

  globals.AudioContext = FakeAudioContext;
  globals.AudioWorkletNode = FakeAudioWorkletNode;
  globals.BaseAudioContext = FakeAudioContext;

  return () => {
    globals.AudioContext = saved.AudioContext;
    globals.AudioWorkletNode = saved.AudioWorkletNode;
    globals.BaseAudioContext = saved.BaseAudioContext;
  };
};

const trackFixture = (id: string, duration: number): Track =>
  ({
    id,
    title: `Track ${id}`,
    artist: "Artist",
    album: "Album",
    duration,
    url: `memory://${id}.m4a`,
    mimeType: "audio/mp4",
    hasStoredAudio: true,
  }) as unknown as Track;

const playlistOf = (tracks: Track[]): Playlist => ({
  id: "playlist",
  name: "Playlist",
  songs: tracks,
});

interface Rig {
  engine: KomorebiEngine;
  worklet: WorkletHarness;
  cleanup: () => void;
  tick(renders?: number): void;
  settle(ms?: number): Promise<void>;
}

const createRig = (decoder: FloStreamDecoderProtocol): Rig => {
  const worklet = createWorkletHarness();
  const restoreWorker = installFakeWorker(decoder);
  const restoreObjectUrls = installObjectUrls();
  const restoreAudio = installFakeAudio(worklet);

  const engine = new KomorebiEngine(new BackendRouter(), {
    crossfade: { enabled: false, duration: 0, shape: "none" },
    gapless: { enabled: true, startOffset: 0, endOffset: 0 },
    smartShuffle: false,
    autoPlayNext: false,
  });

  return {
    engine,
    worklet,
    cleanup: () => {
      engine.dispose();
      restoreWorker();
      restoreObjectUrls();
      restoreAudio();
    },
    tick: (renders = 1) => {
      for (let i = 0; i < renders; i += 1) worklet.render();
    },
    settle: (ms = 20) => jest.advanceTimersByTimeAsync(ms),
  };
};

const startPlayback = async (rig: Rig, target: Track): Promise<void> => {
  const loading = rig.engine.load(target, playlistOf([target]));
  await rig.settle();
  await loading;
  const playing = rig.engine.play();
  await rig.settle();
  await playing;
};

describe("engine playback through the streaming stack", () => {
  let rig: Rig | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    rig?.cleanup();
    rig = null;
    jest.useRealTimers();
  });

  it("keeps playing a track whose duration the decoder never reported", async () => {
    const { decoder } = createDecoder(20, { reportDuration: false });
    const target = trackFixture("unknown-duration", 0);
    rig = createRig(decoder);

    const ended = jest.fn();
    const errors = jest.fn();
    rig.engine.on("ended", ended);
    rig.engine.on("error", errors);

    await startPlayback(rig, target);

    for (let i = 0; i < 100; i += 1) {
      rig.tick(8);
      await rig.settle();
    }

    expect(ended).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(rig.engine.getState().state).toBe("playing");
    expect(rig.worklet.framesPlayed()).toBeGreaterThan(0);
  }, 30000);

  it("streams past the two-second watermark instead of stalling there", async () => {
    const { decoder, producedFrames } = createDecoder(30, { reportDuration: false });
    rig = createRig(decoder);

    await startPlayback(rig, trackFixture("long", 0));

    let peakBuffered = 0;
    const target = HIGH_WATERMARK_FRAMES * 2;
    for (let i = 0; i < 400 && rig.worklet.framesPlayed() < target; i += 1) {
      rig.tick(8);
      await rig.settle();
      peakBuffered = Math.max(peakBuffered, rig.worklet.processor.bufferedFrames);
    }

    expect(rig.worklet.framesPlayed()).toBeGreaterThan(target);
    expect(producedFrames()).toBeGreaterThan(HIGH_WATERMARK_FRAMES);
    expect(peakBuffered).toBeGreaterThan(0);
  }, 60000);

  it("reports the worklet's buffered level so the host can size its next send", async () => {
    const { decoder } = createDecoder(30, { reportDuration: false });
    rig = createRig(decoder);

    await startPlayback(rig, trackFixture("level", 0));

    for (let i = 0; i < 150; i += 1) {
      rig.tick(8);
      await rig.settle();
    }

    const levels = rig.worklet.levels();
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      const payload = level as unknown as { paused: boolean; buffered: number };
      expect(typeof payload.paused).toBe("boolean");
      expect(typeof payload.buffered).toBe("number");
      expect(payload.buffered).toBeGreaterThanOrEqual(0);
    }
    expect(levels.some((level) => (level as unknown as { paused: boolean }).paused === false)).toBe(
      true,
    );
  }, 60000);

  it("ends the track exactly once, after the decoder and the ring are both done", async () => {
    const durationSeconds = 5;
    const { decoder } = createDecoder(durationSeconds);
    rig = createRig(decoder);

    const ended = jest.fn();
    rig.engine.on("ended", ended);

    await startPlayback(rig, trackFixture("complete", durationSeconds));

    const expectedFrames = durationSeconds * SAMPLE_RATE;
    for (let i = 0; i < 600 && ended.mock.calls.length === 0; i += 1) {
      rig.tick(8);
      await rig.settle();
    }

    expect(ended).toHaveBeenCalledTimes(1);
    expect(rig.worklet.framesPlayed()).toBe(expectedFrames - 1);
  }, 60000);
});
