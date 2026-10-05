import type { FloStreamDecoderProtocol, FloStreamInfo } from "./FloStreamPump";

export interface SymphoniaDecoderHandle {
  feed(bytes: Uint8Array): boolean;
  end_of_input(): void;
  has_error(): boolean;
  error_message(): string | null;
  get_info(): {
    sample_rate: number;
    channels: number;
    bit_depth: number;
    total_samples: number;
    codec: string;
  } | null;
  next_frame(): Float32Array | null;
  is_finished(): boolean;
  free(): void;
}

export interface SymphoniaWasmModule {
  SymphoniaDecoder: new () => SymphoniaDecoderHandle;
}

type WasmGlue =
  | SymphoniaWasmModule
  | {
      default: () => Promise<unknown>;
    };

let wasmInitPromise: Promise<SymphoniaWasmModule> | null = null;
let wasmModule: SymphoniaWasmModule | null = null;

export const ensureSymphoniaWasmLoaded = async (): Promise<void> => {
  if (!wasmInitPromise) {
    wasmInitPromise = import("../wasm/symphonia/symphonia.js").then(
      async (glue: WasmGlue) => {
        if ("default" in glue) {
          await glue.default();
        }
        const module = glue as SymphoniaWasmModule;
        wasmModule = module;
        return module;
      },
    );
  }
  await wasmInitPromise;
};

const initializedModule = (): SymphoniaWasmModule => {
  const module = wasmModule;
  if (!module) {
    throw new Error("symphonia wasm has not been initialized");
  }
  return module;
};

class SymphoniaDecoder implements FloStreamDecoderProtocol {
  private readonly wasm: SymphoniaDecoderHandle;

  constructor(module: SymphoniaWasmModule) {
    this.wasm = new module.SymphoniaDecoder();
  }

  private guard<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Symphonia decoder crashed: ${detail || "unknown wasm failure"}`,
      );
    }
  }

  feed(chunk: Uint8Array): boolean {
    return this.guard(() => this.wasm.feed(chunk));
  }

  end_of_input(): void {
    this.guard(() => {
      this.wasm.end_of_input();
    });
  }

  get_info(): FloStreamInfo | null {
    const info = this.guard(() => this.wasm.get_info());
    if (info == null) return null;
    return {
      sample_rate: info.sample_rate,
      channels: info.channels,
      bit_depth: info.bit_depth,
      total_samples: BigInt(info.total_samples),
    };
  }

  has_error(): boolean {
    return this.guard(() => this.wasm.has_error());
  }

  error_message(): string | null {
    const message = this.guard(() => this.wasm.error_message());
    return message == null ? null : message;
  }

  next_frame(): Float32Array | null {
    const frame = this.guard(() => this.wasm.next_frame());
    if (frame == null) return null;
    return frame;
  }

  is_finished(): boolean {
    return this.guard(() => this.wasm.is_finished());
  }

  free(): void {
    this.guard(() => {
      this.wasm.free();
    });
  }
}

export const createSymphoniaStreamingDecoder = (
  module: SymphoniaWasmModule | null = null,
): FloStreamDecoderProtocol =>
  new SymphoniaDecoder(module ?? initializedModule());
