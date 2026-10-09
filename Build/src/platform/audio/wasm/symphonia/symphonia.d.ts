/* tslint:disable */
/* eslint-disable */

/**
 * Stream parameters reported once the codec header is decoded.
 */
export class DecoderInfo {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  readonly bit_depth: number;
  readonly channels: number;
  readonly codec: string;
  readonly sample_rate: number;
  readonly total_samples: number;
}

export class SymphoniaDecoder {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Reports whether the previous `next_frame` call exhausted its per-call
   * packet budget and returned without examining every queued packet. The
   * host should resume decoding on a later turn so the main thread stays
   * responsive while large streams decode.
   */
  budget_exhausted(): boolean;
  /**
   * Marks the end of the input byte stream. Container parsing may still
   * require the complete file (e.g. an MP4 `moov` atom at the end), so
   * decode can only begin once this has been called for such files.
   */
  end_of_input(): void;
  error_message(): string | undefined;
  feed(bytes: Uint8Array): boolean;
  free(): void;
  get_info(): DecoderInfo | undefined;
  has_error(): boolean;
  /**
   * Reports whether the previous `next_frame` call reached the end of the
   * decoded stream.
   */
  is_finished(): boolean;
  /**
   * Reports whether the previous `next_frame` call stopped because more
   * input bytes are required (rather than because the stream ended).
   */
  is_pending(): boolean;
  constructor();
  /**
   * Decodes and returns the next packet as an interleaved f32 `Float32Array`
   * in the stream's native channel order, or `null` when the callback should
   * stop. Consult `is_pending`, `is_finished`, and `budget_exhausted` to
   * distinguish "wait for more input" from "stream over" from "resume on a
   * later turn".
   */
  next_frame(): Float32Array | undefined;
}

export type InitInput =
  RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_decoderinfo_free: (a: number, b: number) => void;
  readonly __wbg_symphoniadecoder_free: (a: number, b: number) => void;
  readonly decoderinfo_bit_depth: (a: number) => number;
  readonly decoderinfo_channels: (a: number) => number;
  readonly decoderinfo_codec: (a: number) => [number, number];
  readonly decoderinfo_sample_rate: (a: number) => number;
  readonly decoderinfo_total_samples: (a: number) => number;
  readonly symphoniadecoder_budget_exhausted: (a: number) => number;
  readonly symphoniadecoder_end_of_input: (a: number) => void;
  readonly symphoniadecoder_error_message: (a: number) => [number, number];
  readonly symphoniadecoder_feed: (a: number, b: number, c: number) => number;
  readonly symphoniadecoder_free: (a: number) => void;
  readonly symphoniadecoder_get_info: (a: number) => number;
  readonly symphoniadecoder_has_error: (a: number) => number;
  readonly symphoniadecoder_is_finished: (a: number) => number;
  readonly symphoniadecoder_is_pending: (a: number) => number;
  readonly symphoniadecoder_new: () => number;
  readonly symphoniadecoder_next_frame: (a: number) => any;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(
  module: { module: SyncInitInput } | SyncInitInput,
): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
