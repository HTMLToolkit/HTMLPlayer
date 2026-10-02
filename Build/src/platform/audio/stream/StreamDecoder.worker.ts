import {
  FloStreamPump,
  createRealStreamingDecoder,
  ensureFloWasmLoaded,
} from "./FloStreamPump";
import type { FloStreamPumpEvents } from "./FloStreamPump";
import {
  createSymphoniaStreamingDecoder,
  ensureSymphoniaWasmLoaded,
} from "./SymphoniaDecoder";

export type StreamDecoderEngine = "symphonia" | "flo";

interface StreamStartMessage {
  type: "start";
  streamId: number;
  url: string;
  engine: StreamDecoderEngine;
  skipToFrames: number;
}

interface StreamCancelMessage {
  type: "cancel";
  streamId: number;
}

interface StreamPressureMessage {
  type: "pressure";
  streamId: number;
  shouldPause: boolean;
}

interface ActiveStream {
  streamId: number;
  pump: FloStreamPump;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

const engineReady: Partial<Record<StreamDecoderEngine, Promise<void>>> = {};

let currentStreamId = -1;
let activeStream: ActiveStream | null = null;

const post = (message: object, transfer: Transferable[] = []): void => {
  scope.postMessage(message, transfer);
};

const ensureEngine = (engine: StreamDecoderEngine): Promise<void> => {
  engineReady[engine] ??=
    engine === "symphonia"
      ? ensureSymphoniaWasmLoaded()
      : ensureFloWasmLoaded();
  return engineReady[engine];
};

const createDecoder = (engine: StreamDecoderEngine) => {
  if (engine === "symphonia") {
    return createSymphoniaStreamingDecoder();
  }
  return createRealStreamingDecoder();
};

const cancelStream = (streamId: number): void => {
  if (activeStream && activeStream.streamId === streamId) {
    activeStream.pump.cancel();
    activeStream = null;
  }
  if (currentStreamId === streamId) {
    currentStreamId = -1;
  }
};

const startStream = async (message: StreamStartMessage): Promise<void> => {
  if (currentStreamId !== message.streamId) {
    currentStreamId = message.streamId;
  }
  try {
    await ensureEngine(message.engine);
  } catch (error) {
    if (currentStreamId !== message.streamId) return;
    currentStreamId = -1;
    post({
      type: "error",
      streamId: message.streamId,
      message: `decoder engine init failed: ${String(error)}`,
    });
    return;
  }
  if (currentStreamId !== message.streamId) return;

  cancelStream(message.streamId);

  const events: FloStreamPumpEvents = {
    onInfo: (info) => {
      post({
        type: "info",
        streamId: message.streamId,
        info,
      });
    },
    onChunk: (chunk) => {
      post(
        {
          type: "chunk",
          streamId: message.streamId,
          data: chunk,
        },
        [chunk.buffer],
      );
    },
    onEnd: () => {
      post({ type: "end", streamId: message.streamId });
    },
    onError: (error) => {
      post({
        type: "error",
        streamId: message.streamId,
        message: error.message,
      });
    },
    onPressureChange: (shouldPause) => {
      post({
        type: "pressure",
        streamId: message.streamId,
        shouldPause,
      });
    },
  };

  const pump = new FloStreamPump({
    url: message.url,
    decoder: createDecoder(message.engine),
    events,
  });
  activeStream = { streamId: message.streamId, pump };
  void pump.start(message.skipToFrames ?? 0);
};

scope.onmessage = (event: MessageEvent) => {
  const message = event.data as
    StreamStartMessage | StreamCancelMessage | StreamPressureMessage | null;
  if (!message) return;
  if (message.type === "cancel") {
    cancelStream(message.streamId);
    return;
  }
  if (message.type === "pressure") {
    if (!activeStream || activeStream.streamId !== message.streamId) return;
    if (message.shouldPause) {
      activeStream.pump.pause();
    } else {
      activeStream.pump.resume();
    }
    return;
  }
  void startStream(message);
};
