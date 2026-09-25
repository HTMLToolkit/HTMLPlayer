import { describe, it, expect, jest } from "@jest/globals";
import { FloStreamPump } from "../src/platform/audio/stream/FloStreamPump";

interface FakeDecoder {
  feed(chunk: Uint8Array): boolean;
  get_info(): { sample_rate: number; channels: number; bit_depth: number } | null;
  has_error(): boolean;
  next_frame(): Float32Array | null;
  free?(): void;
}

const CHANNELS = 2;
const FRAMES_PER_BLOCK = 100;

const makeDecoder = (blocks: number, cumulativeDemands: number[]) => {
  const produced: Float32Array[] = [];
  for (let b = 0; b < blocks; b++) {
    const data = new Float32Array(FRAMES_PER_BLOCK * CHANNELS);
    for (let i = 0; i < FRAMES_PER_BLOCK; i++) {
      data[i * CHANNELS] = b;
      data[i * CHANNELS + 1] = b;
    }
    produced.push(data);
  }

  let feeds = 0;
  let unlocked = 0;
  let next = 0;

  const decoder: FakeDecoder = {
    feed(): boolean {
      feeds++;
      const demand = cumulativeDemands[feeds - 1];
      if (demand !== undefined) {
        unlocked = Math.max(unlocked, Math.min(blocks, demand));
      }
      return true;
    },
    get_info() {
      return { sample_rate: 44100, channels: CHANNELS, bit_depth: 16 };
    },
    has_error() {
      return false;
    },
    next_frame() {
      if (next >= unlocked) return null;
      return produced[next++] ?? null;
    },
    free() {},
  };
  return decoder;
};

const streamFromChunks = (chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

const makeFetcher = (chunks: Uint8Array[]) =>
  jest.fn(async (_url: string, _signal: AbortSignal) => ({
    ok: true,
    status: 200,
    body: streamFromChunks(chunks),
  }));

interface Collected {
  chunks: Float32Array[];
  infos: number[];
  ended: boolean;
  errors: Error[];
}

const collect = () => {
  const state: Collected = {
    chunks: [],
    infos: [],
    ended: false,
    errors: [],
  };
  const endedPromise = new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (state.ended) {
        clearInterval(timer);
        resolve();
      } else if (state.errors.length > 0) {
        clearInterval(timer);
        resolve();
      }
    }, 1);
  });
  return { state, endedPromise };
};

describe("FloStreamPump", () => {
  it("emits decoded blocks progressively and completes the stream", async () => {
    const decoder = makeDecoder(3, [1, 3]);
    const fetcher = makeFetcher([
      new Uint8Array([1, 2, 3, 4]),
      new Uint8Array([5]),
    ]);
    const { state, endedPromise } = collect();

    const pump = new FloStreamPump({
      url: "blob:fake",
      decoder,
      events: {
        onInfo: (info) => state.infos.push(info.sample_rate),
        onChunk: (chunk) => state.chunks.push(chunk),
        onEnd: () => {
          state.ended = true;
        },
        onError: (error) => state.errors.push(error),
      },
      fetcher,
    });

    await expect(pump.start(0)).resolves.toBeUndefined();

    expect(state.chunks.length).toBe(1);
    expect(state.chunks[0]).toHaveLength(FRAMES_PER_BLOCK * CHANNELS);
    expect(state.infos).toContain(44100);

    await endedPromise;

    expect(state.chunks.length).toBe(3);
    const totalFrames = state.chunks.reduce(
      (sum, chunk) => sum + chunk.length / CHANNELS,
      0,
    );
    expect(totalFrames).toBe(FRAMES_PER_BLOCK * 3);
    expect(state.errors).toHaveLength(0);
  });

  it("slices into the block containing the seek target and continues from there", async () => {
    const decoder = makeDecoder(3, [3]);
    const fetcher = makeFetcher([new Uint8Array([1, 2, 3])]);
    const { state, endedPromise } = collect();

    const pump = new FloStreamPump({
      url: "blob:fake",
      decoder,
      events: {
        onInfo: () => undefined,
        onChunk: (chunk) => state.chunks.push(chunk),
        onEnd: () => {
          state.ended = true;
        },
        onError: (error) => state.errors.push(error),
      },
      fetcher,
    });

    await expect(pump.start(150)).resolves.toBeUndefined();

    expect(state.chunks.length).toBe(2);
    const first = state.chunks[0]!;
    expect(first).toHaveLength((FRAMES_PER_BLOCK - 50) * CHANNELS);
    expect(first[0]).toBe(1);
    expect(first[CHANNELS]).toBe(1);
    expect(state.chunks[1]).toHaveLength(FRAMES_PER_BLOCK * CHANNELS);

    await endedPromise;
    expect(pump.frames).toBe(FRAMES_PER_BLOCK * 3);
  });

  it("reports HTTP errors without emitting audio", async () => {
    const decoder = makeDecoder(1, [1]);
    const fetcher = jest.fn(async () => ({
      ok: false,
      status: 404,
      body: null,
    }));
    const { state } = collect();

    const pump = new FloStreamPump({
      url: "https://missing.example/not.flo",
      decoder,
      events: {
        onInfo: () => undefined,
        onChunk: (chunk) => state.chunks.push(chunk),
        onEnd: () => {
          state.ended = true;
        },
        onError: (error) => state.errors.push(error),
      },
      fetcher,
    });

    await expect(pump.start(0)).resolves.toBeUndefined();

    expect(state.chunks).toHaveLength(0);
    expect(state.ended).toBe(false);
    expect(state.errors[0]?.message).toContain("404");
  });

  it("surfaces decoder rejection of fed data as an error", async () => {
    const decoder = makeDecoder(1, [1]);
    decoder.feed = () => false;
    const fetcher = makeFetcher([new Uint8Array([1])]);
    const { state } = collect();

    const pump = new FloStreamPump({
      url: "blob:fake",
      decoder,
      events: {
        onInfo: () => undefined,
        onChunk: (chunk) => state.chunks.push(chunk),
        onEnd: () => {
          state.ended = true;
        },
        onError: (error) => state.errors.push(error),
      },
      fetcher,
    });

    await expect(pump.start(0)).resolves.toBeUndefined();

    expect(state.errors[0]?.message).toBe("flo decoder rejected stream data");
  });
});