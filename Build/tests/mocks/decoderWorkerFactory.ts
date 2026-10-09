export function createDecoderWorker(): Worker {
  const Ctor = (globalThis as { Worker?: new () => Worker }).Worker;
  if (!Ctor) {
    throw new Error("No global Worker is available for the decoder worker stub");
  }
  return new Ctor();
}