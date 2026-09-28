import type { FloStreamInfo, FloStreamPumpEvents } from "./FloStreamPump";
import type { StreamDecoderEngine } from "./StreamDecoder.worker";

interface WorkerStartMessage {
  type: "start";
  streamId: number;
  url: string;
  engine: StreamDecoderEngine;
  skipToFrames: number;
}

interface WorkerCancelMessage {
  type: "cancel";
  streamId: number;
}

interface WorkerEventMessage {
  type: "info" | "chunk" | "end" | "error";
  streamId: number;
  info?: FloStreamInfo;
  data?: Float32Array;
  message?: string;
}

export interface StreamDecoderClientOptions {
  engine: StreamDecoderEngine;
  events: FloStreamPumpEvents;
}

export class StreamDecoderClient {
  private readonly engine: StreamDecoderEngine;
  private readonly events: FloStreamPumpEvents;
  private worker: Worker | null = null;
  private streamId = 0;
  private resolveStart: (() => void) | null = null;
  private startPromise: Promise<void> | null = null;
  private disposed = false;

  constructor(options: StreamDecoderClientOptions) {
    this.engine = options.engine;
    this.events = options.events;
  }

  start(url: string, skipToFrames = 0): Promise<void> {
    if (this.disposed) {
      throw new Error("stream decoder client has been disposed");
    }
    const worker = this.ensureWorker();
    const streamId = ++this.streamId;
    this.startPromise = new Promise<void>((resolve) => {
      this.resolveStart = resolve;
    });
    const message: WorkerStartMessage = {
      type: "start",
      streamId,
      url,
      engine: this.engine,
      skipToFrames,
    };
    worker.postMessage(message);
    return this.startPromise;
  }

  cancel(): void {
    if (this.worker) {
      const message: WorkerCancelMessage = {
        type: "cancel",
        streamId: this.streamId,
      };
      this.worker.postMessage(message);
    }
    this.settleStart();
  }

  dispose(): void {
    this.disposed = true;
    this.settleStart();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(
      new URL("./StreamDecoder.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent) => this.handleMessage(event);
    worker.onerror = (event: ErrorEvent) => {
      this.events.onError?.(
        new Error(
          `decoder worker failed: ${event.message || "unexpected error"}`,
        ),
      );
      this.settleStart();
    };
    this.worker = worker;
    return worker;
  }

  private handleMessage(event: MessageEvent): void {
    const message = event.data as WorkerEventMessage | null;
    if (!message || message.streamId !== this.streamId) return;
    switch (message.type) {
      case "info":
        if (message.info) {
          this.events.onInfo?.(message.info);
        }
        return;
      case "chunk":
        if (message.data) {
          this.events.onChunk?.(message.data);
        } else {
          this.events.onError?.(
            new Error("decoder worker delivered an empty chunk"),
          );
        }
        this.settleStart();
        return;
      case "end":
        this.events.onEnd?.();
        this.settleStart();
        return;
      case "error":
        this.events.onError?.(
          new Error(message.message ?? "stream decode failed"),
        );
        this.settleStart();
        return;
    }
  }

  private settleStart(): void {
    const resolve = this.resolveStart;
    this.resolveStart = null;
    this.startPromise = null;
    resolve?.();
  }
}
