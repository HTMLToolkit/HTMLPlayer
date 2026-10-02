import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initFlo, {
  encode,
  create_metadata,
  validate,
  info,
  get_metadata,
  get_cover_art,
  WasmStreamingDecoder,
} from "@audiflo/libflo";
import assert from "node:assert/strict";
import { FloStreamPump } from "../../../src/platform/audio/stream/FloStreamPump.ts";

const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const SECONDS = 3;
const TOTAL_FRAMES = SAMPLE_RATE * SECONDS;

const libDir = path.dirname(fileURLToPath(import.meta.resolve("@audiflo/libflo")));
const wasmPath = path.join(libDir, "libflo_audio_bg.wasm");
await initFlo({
  module_or_path: new Uint8Array(readFileSync(wasmPath)).buffer,
});

const sineFixture = (): Float64Array => {
  const samples = new Float64Array(TOTAL_FRAMES * CHANNELS);
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const v = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 0.5;
    samples[i * CHANNELS] = v;
    samples[i * CHANNELS + 1] = v;
  }
  return samples;
};

const flo = encode(
  sineFixture(),
  SAMPLE_RATE,
  CHANNELS,
  16,
  create_metadata("E2E Title", "E2E Artist", "E2E Album"),
);
const bytes = new Uint8Array(flo);

assert(validate(flo));
const audioInfo = info(flo);
assert.strictEqual(audioInfo.sample_rate, SAMPLE_RATE);
assert.strictEqual(audioInfo.channels, CHANNELS);
assert.strictEqual(audioInfo.bit_depth, 16);
assert.strictEqual(audioInfo.total_samples, BigInt(TOTAL_FRAMES));
assert.ok(Math.abs(audioInfo.duration_secs - SECONDS) < 1e-6);
const parsedSeconds =
  Number(audioInfo.total_samples) / audioInfo.sample_rate;
assert.ok(Math.abs(audioInfo.duration_secs - parsedSeconds) < 1e-6);

const tags = get_metadata(bytes);
assert.ok(tags);
assert.strictEqual(tags.title, "E2E Title");
assert.strictEqual(tags.artist, "E2E Artist");
assert.strictEqual(tags.album, "E2E Album");

assert.strictEqual((audioInfo as { artist?: string }).artist, undefined);

assert.strictEqual(get_cover_art(bytes), null);

const untagged = new Uint8Array(encode(sineFixture(), SAMPLE_RATE, CHANNELS, 16));
const plainTags = get_metadata(untagged);
assert.ok(plainTags);
assert.strictEqual(plainTags.title, undefined);
assert.strictEqual(plainTags.artist, undefined);
assert.strictEqual(plainTags.album, undefined);

const emptyTagged = new Uint8Array(
  encode(
    sineFixture(),
    SAMPLE_RATE,
    CHANNELS,
    16,
    create_metadata("", "", ""),
  ),
);
const emptyTags = get_metadata(emptyTagged);
assert.ok(emptyTags);
assert.strictEqual(emptyTags.title, "");
assert.strictEqual(emptyTags.artist, "");
assert.strictEqual(emptyTags.album, "");

const streamChunks = (): Uint8Array[] => {
  const parts: Uint8Array[] = [];
  const head = Math.floor(bytes.length * 0.6);
  parts.push(bytes.subarray(0, head));
  parts.push(bytes.subarray(head));
  return parts;
};

{
  const chunks = streamChunks();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  const emitted: Float32Array[] = [];
  let ended = false;
  const pump = new FloStreamPump({
    url: "blob:fixture",
    decoder: new WasmStreamingDecoder(),
    events: {
      onChunk: (chunk) => emitted.push(chunk),
      onEnd: () => {
        ended = true;
      },
    },
    fetcher: async () => ({ ok: true, status: 200, body }),
  });

  await pump.start(0);
  assert.ok(emitted.length >= 1, "first block emitted while still streaming");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.strictEqual(ended, true);

  const frames = emitted.reduce(
    (sum, chunk) => sum + chunk.length / CHANNELS,
    0,
  );
  assert.strictEqual(frames, TOTAL_FRAMES);
}

{
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const emitted: Float32Array[] = [];
  const pump = new FloStreamPump({
    url: "blob:fixture",
    decoder: new WasmStreamingDecoder(),
    events: {
      onChunk: (chunk) => emitted.push(chunk),
      onEnd: () => undefined,
    },
    fetcher: async () => ({ ok: true, status: 200, body }),
  });

  const targetFrames = Math.floor(1.5 * SAMPLE_RATE);
  await pump.start(targetFrames);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.strictEqual(pump.frames, TOTAL_FRAMES);
  assert.strictEqual(emitted.length, 2);
  assert.strictEqual(
    emitted[0]!.length / CHANNELS,
    SAMPLE_RATE - (targetFrames % SAMPLE_RATE),
  );
  const emittedFrames = emitted.reduce(
    (sum, chunk) => sum + chunk.length / CHANNELS,
    0,
  );
  assert.strictEqual(emittedFrames, TOTAL_FRAMES - targetFrames);
}

console.log("flo E2E ok: encode -> validate -> info -> get_metadata round-trip, streaming + seek-slice verified");