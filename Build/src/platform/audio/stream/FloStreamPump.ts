import { WasmStreamingDecoder } from "@audiflo/libflo";

export interface FloStreamInfo {
  sample_rate: number;
  channels: number;
  bit_depth: number;
  total_samples?: bigint;
}

export interface FloStreamDecoderProtocol {
  feed(chunk: Uint8Array): boolean;
  get_info(): FloStreamInfo | null;
  has_error(): boolean;
  next_frame(): Float32Array | null;
  free?(): void;
}

export interface FloStreamResponse {
  ok: boolean;
  status: number;
  body: ReadableStream<Uint8Array> | null;
}

export type FloStreamFetcher = (
  url: string,
  signal: AbortSignal,
) => Promise<FloStreamResponse>;

export interface FloStreamPumpEvents {
  onInfo?(info: FloStreamInfo): void;
  onChunk?(chunk: Float32Array): void;
  onEnd?(): void;
  onError?(error: Error): void;
}

const defaultFetcher: FloStreamFetcher = (url, signal) =>
  fetch(url, { signal }) as Promise<FloStreamResponse>;

export class FloStreamPump {
  private readonly url: string;
  private readonly events: FloStreamPumpEvents;
  private readonly decoder: FloStreamDecoderProtocol;
  private readonly fetcher: FloStreamFetcher;
  private readonly controller = new AbortController();
  private cancelled = false;
  private framesDecoded = 0;
  private channels = 0;
  private skipping = false;
  private skipTarget = 0;
  private failure: Error | null = null;
  private firstAudioReady: (() => void) | null = null;

  constructor(options: {
    url: string;
    decoder: FloStreamDecoderProtocol;
    events?: FloStreamPumpEvents;
    fetcher?: FloStreamFetcher;
  }) {
    this.url = options.url;
    this.decoder = options.decoder;
    this.events = options.events ?? {};
    this.fetcher = options.fetcher ?? defaultFetcher;
  }

  start(skipToFrames = 0): Promise<void> {
    this.skipping = skipToFrames > 0;
    this.skipTarget = skipToFrames;

    const firstAudio = new Promise<void>((resolve) => {
      this.firstAudioReady = resolve;
    });

    void this.run();

    return firstAudio;
  }

  get frames(): number {
    return this.framesDecoded;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  cancel(): void {
    this.cancelled = true;
    this.firstAudioReady?.();
    this.controller.abort();
    this.decoder.free?.();
  }

  private async run(): Promise<void> {
    let response: FloStreamResponse;
    try {
      response = await this.fetcher(this.url, this.controller.signal);
    } catch (error) {
      if (this.cancelled) return;
      this.fail(error as Error);
      return;
    }

    if (!response.ok || response.body === null) {
      if (!this.cancelled) {
        this.fail(new Error(`HTTP ${response.status}`));
      }
      return;
    }

    const reader = response.body.getReader();
    try {
      for (;;) {
        if (this.cancelled) {
          await this.silenceReader(reader);
          return;
        }
        const { value, done } = await reader.read();
        if (this.cancelled) {
          await this.silenceReader(reader);
          return;
        }
        if (done) break;

        if (value.length > 0) {
          const accepted = this.decoder.feed(value);
          if (!accepted || this.decoder.has_error()) {
            this.fail(new Error("flo decoder rejected stream data"));
            return;
          }
          this.drain();
        }
        await this.yieldToMain();
      }

      if (this.cancelled) return;
      this.drain();
      if (this.cancelled) return;
      this.firstAudioReady?.();
      this.events.onEnd?.();
    } catch (error) {
      if (!this.cancelled) {
        this.fail(error as Error);
      }
    }
  }

  private drain(): void {
    for (;;) {
      if (this.channels === 0) {
        const info = this.decoder.get_info();
        if (info && info.channels > 0) {
          this.channels = info.channels;
          this.events.onInfo?.(info);
        }
      }

      const chunk = this.decoder.next_frame();
      if (chunk === null || chunk.length === 0) break;

      if (this.channels === 0) {
        this.framesDecoded += 1;
        continue;
      }

      const chunkFrames = Math.floor(chunk.length / this.channels);
      if (this.skipping && this.framesDecoded + chunkFrames < this.skipTarget) {
        this.framesDecoded += chunkFrames;
        continue;
      }

      let block = chunk;
      if (this.skipping) {
        const offset = Math.max(0, this.skipTarget - this.framesDecoded);
        const cut = Math.min(offset, chunkFrames);
        block = chunk.subarray(cut * this.channels);
        this.framesDecoded += chunkFrames;
        this.skipping = false;
        if (block.length === 0) continue;
      } else {
        this.framesDecoded += chunkFrames;
      }

      this.events.onChunk?.(block);
      this.firstAudioReady?.();
      this.firstAudioReady = null;
    }
  }

  private fail(error: Error): void {
    if (this.failure) return;
    this.failure = error;
    this.firstAudioReady?.();
    this.events.onError?.(error);
  }

  private async silenceReader(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): Promise<void> {
    try {
      await reader.cancel();
    } catch {}
  }

  private async yieldToMain(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

export const createRealStreamingDecoder = (): FloStreamDecoderProtocol =>
  new WasmStreamingDecoder();
