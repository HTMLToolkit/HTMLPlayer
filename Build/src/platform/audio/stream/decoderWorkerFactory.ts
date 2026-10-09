import StreamDecoderWorker from "./StreamDecoder.worker.ts?worker";

export function createDecoderWorker(): Worker {
  return new StreamDecoderWorker();
}