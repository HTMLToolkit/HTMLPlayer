import StreamDecoderWorker from "./StreamDecoder.worker.ts?worker&inline";

export function createDecoderWorker(): Worker {
  return new StreamDecoderWorker();
}