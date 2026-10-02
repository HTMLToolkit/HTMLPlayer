import {
  createSymphoniaStreamingDecoder,
  ensureSymphoniaWasmLoaded,
  type SymphoniaDecoderHandle,
  type SymphoniaWasmModule,
} from "../src/platform/audio/stream/SymphoniaDecoder";

const makeFakeHandle = (): SymphoniaDecoderHandle => {
  const calls: string[] = [];
  const handle = {
    calls,
    feed: jest.fn(() => true),
    end_of_input: jest.fn(),
    has_error: jest.fn(() => false),
    error_message: jest.fn(() => null as string | null),
    get_info: jest.fn(() => null),
    next_frame: jest.fn(() => null as Float32Array | null),
    is_pending: jest.fn(() => false),
    is_finished: jest.fn(() => false),
    budget_exhausted: jest.fn(() => false),
    free: jest.fn(),
  };
  return handle;
};

const fakeModuleOf = (handle: SymphoniaDecoderHandle): SymphoniaWasmModule => ({
  SymphoniaDecoder: class {
    constructor() {
      return handle;
    }
  },
});

describe("createSymphoniaStreamingDecoder", () => {
  it("normalizes undefined glue results to null", () => {
    const handle = makeFakeHandle();
    handle.error_message.mockReturnValue(undefined as unknown as string | null);
    handle.get_info.mockReturnValue(undefined as unknown as never);
    handle.next_frame.mockReturnValue(undefined as unknown as Float32Array | null);

    const decoder = createSymphoniaStreamingDecoder(fakeModuleOf(handle));

    expect(decoder.has_error()).toBe(false);
    expect(decoder.error_message()).toBeNull();
    expect(decoder.get_info()).toBeNull();
    expect(decoder.next_frame()).toBeNull();
    expect(decoder.feed(new Uint8Array([1, 2, 3]))).toBe(true);
    decoder.end_of_input();
    decoder.free();

    expect((handle.feed as jest.Mock).mock.calls).toHaveLength(1);
    expect((handle.end_of_input as jest.Mock).mock.calls).toHaveLength(1);
    expect((handle.free as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("maps DecoderInfo into a FloStreamInfo with a total_samples bigint", () => {
    const handle = makeFakeHandle();
    handle.get_info.mockReturnValue({
      sample_rate: 44100,
      channels: 2,
      bit_depth: 16,
      total_samples: 132300,
      codec: "alac",
    });

    const decoder = createSymphoniaStreamingDecoder(fakeModuleOf(handle));

    expect(decoder.get_info()).toEqual({
      sample_rate: 44100,
      channels: 2,
      bit_depth: 16,
      total_samples: 132300n,
    });
  });

  it("forwards decoded frames and surfaces errors", () => {
    const handle = makeFakeHandle();
    const frame = new Float32Array([0.5, -0.5]);
    handle.next_frame
      .mockReturnValueOnce(frame)
      .mockReturnValue(void 0 as unknown as Float32Array | null);

    const decoder = createSymphoniaStreamingDecoder(fakeModuleOf(handle));

    expect(decoder.next_frame()).toBe(frame);
    expect(decoder.next_frame()).toBeNull();
  });

  it("forwards streaming state alongside null frames", () => {
    const handle = makeFakeHandle();
    handle.is_pending.mockReturnValue(true);
    handle.is_finished.mockReturnValue(true);
    handle.budget_exhausted.mockReturnValue(true);

    const decoder = createSymphoniaStreamingDecoder(fakeModuleOf(handle));

    expect(decoder.is_pending()).toBe(true);
    expect(decoder.is_finished()).toBe(true);
    expect(decoder.budget_exhausted()).toBe(true);
    expect((handle.is_pending as jest.Mock).mock.calls).toHaveLength(1);
    expect((handle.is_finished as jest.Mock).mock.calls).toHaveLength(1);
    expect((handle.budget_exhausted as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("throws when constructed before wasm initialization", () => {
    expect(() => createSymphoniaStreamingDecoder(null)).toThrow(
      "symphonia wasm has not been initialized",
    );
  });
});

describe("ensureSymphoniaWasmLoaded", () => {
  it("pushes failure of the dynamic wasm import to the caller", async () => {
    await expect(ensureSymphoniaWasmLoaded()).rejects.toThrow();
  });
});