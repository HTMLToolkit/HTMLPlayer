import { describe, it, expect, jest } from "@jest/globals";
import { FloStreamPump } from "../src/platform/audio/stream/FloStreamPump";

interface FakeDecoder {
  feed(chunk: Uint8Array): boolean;
  get_info(): { sample_rate: number; channels: number; bit_depth: number } | null;
  has_error(): boolean;
  next_frame(): Float32Array | null;
  is_finished(): boolean;
  error_message?(): string | null;
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
    is_finished(): boolean {
      return next >= blocks;
    },
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

const settle = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 2000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("timed out waiting for condition");
    }
    await settle(5);
  }
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

  it("treats a feed() that declines input as backpressure, not a failure", async () => {
    const decoder = makeDecoder(3, [3]);
    const innerFeed = decoder.feed.bind(decoder);
    let feeds = 0;
    decoder.feed = (chunk: Uint8Array) => {
      feeds++;
      innerFeed(chunk);
      return feeds !== 1;
    };
    const fetcher = makeFetcher([
      new Uint8Array([1, 2, 3, 4]),
      new Uint8Array([5]),
    ]);
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

    await expect(pump.start(0)).resolves.toBeUndefined();

    expect(state.errors).toHaveLength(0);

    await endedPromise;

    expect(state.chunks.length).toBe(3);
    const totalFrames = state.chunks.reduce(
      (sum, chunk) => sum + chunk.length / CHANNELS,
      0,
    );
    expect(totalFrames).toBe(FRAMES_PER_BLOCK * 3);
  });

  it("surfaces a decoder error flag as a stream failure", async () => {
    const decoder = makeDecoder(1, [1]);
    decoder.has_error = () => true;
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

    expect(state.chunks).toHaveLength(0);
    expect(state.errors[0]?.message).toBe("decoder reported an error");
  });

  it("prefers the decoder's own error detail when it exposes one", async () => {
    const decoder = makeDecoder(1, [1]);
    decoder.has_error = () => true;
    const detailed: FakeDecoder = Object.assign(decoder, {
      error_message: () => "alac: invalid frame at 0x1f40",
    });
    const fetcher = makeFetcher([new Uint8Array([1])]);
    const { state } = collect();

    const pump = new FloStreamPump({
      url: "blob:fake",
      decoder: detailed,
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

    expect(state.errors[0]?.message).toBe("alac: invalid frame at 0x1f40");
  });

  it("does not treat an idle drain as end of input while the decoder is unfinished", async () => {
    const blocks = 4;
    let inputEnded = false;
    let idleRoundsLeft = 2;
    let next = 0;

    const decoder: FakeDecoder = {
      feed: () => true,
      get_info: () => ({
        sample_rate: 48000,
        channels: CHANNELS,
        bit_depth: 16,
      }),
      has_error: () => false,
      next_frame: () => {
        if (!inputEnded) return null;
        if (idleRoundsLeft > 0) {
          idleRoundsLeft--;
          return null;
        }
        if (next >= blocks) return null;
        const block = new Float32Array(FRAMES_PER_BLOCK * CHANNELS);
        block.fill(next);
        next++;
        return block;
      },
      is_finished: () => next >= blocks,
      end_of_input: () => {
        inputEnded = true;
      },
      free: () => undefined,
    };

    const fetcher = makeFetcher([new Uint8Array([1, 2, 3, 4])]);
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

    await expect(pump.start(0)).resolves.toBeUndefined();
    await endedPromise;

    expect(state.errors).toHaveLength(0);
    expect(state.chunks).toHaveLength(blocks);
    expect(state.ended).toBe(true);
  });

  it("stops an end-of-stream drain that never reports itself finished", async () => {
    let drainRounds = 0;
    const decoder: FakeDecoder = {
      feed: () => true,
      get_info: () => ({
        sample_rate: 48000,
        channels: CHANNELS,
        bit_depth: 16,
      }),
      has_error: () => false,
      next_frame: () => {
        drainRounds++;
        return null;
      },
      is_finished: () => false,
      end_of_input: () => undefined,
      free: () => undefined,
    };

    const fetcher = makeFetcher([new Uint8Array([1])]);
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

    await expect(pump.start(0)).resolves.toBeUndefined();
    await endedPromise;

    expect(state.ended).toBe(true);
    expect(drainRounds).toBeLessThan(500);
  });

  it("stops decoding while paused and resumes without dropping frames", async () => {
    const maxBlocks = 1000;
    const smallBlock = 8;
    let produced = 0;
    const decoder: FakeDecoder = {
      feed: () => true,
      get_info: () => ({
        sample_rate: 48000,
        channels: CHANNELS,
        bit_depth: 16,
      }),
      has_error: () => false,
      next_frame: () => {
        if (produced >= maxBlocks) return null;
        const block = new Float32Array(smallBlock * CHANNELS);
        block.fill(produced);
        produced++;
        return block;
      },
      free: () => undefined,
    };
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array([1]));
        },
      }),
    }));

    const chunks: Float32Array[] = [];
    const errors: Error[] = [];
    let pump: FloStreamPump | null = null;
    let pauseRequested = false;

    pump = new FloStreamPump({
      url: "blob:fake",
      decoder,
      events: {
        onInfo: () => undefined,
        onChunk: (chunk) => {
          chunks.push(chunk);
          if (chunks.length === 2 && pump) {
            pauseRequested = true;
            pump.pause();
          }
        },
        onEnd: () => {
          throw new Error("endless stream must not report end");
        },
        onError: (error) => errors.push(error),
      },
      fetcher,
    });

    await pump.start(0);
    await waitFor(() => pauseRequested);
    await settle(120);

    const whilePaused = chunks.length;
    expect(whilePaused).toBeGreaterThan(0);
    expect(whilePaused).toBeLessThan(maxBlocks);

    await settle(150);
    expect(chunks.length).toBe(whilePaused);

    pump.resume();
    await waitFor(() => chunks.length > whilePaused);
    pump.cancel();

    expect(errors).toHaveLength(0);
    expect(chunks.map((chunk) => chunk[0])).toEqual(
      chunks.map((_chunk, index) => index),
    );
  });
});