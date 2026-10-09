import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSymphonia from "../../../src/platform/audio/wasm/symphonia/symphonia.js";
import { FloStreamPump } from "../../../src/platform/audio/stream/FloStreamPump.ts";
import { createSymphoniaStreamingDecoder } from "../../../src/platform/audio/stream/SymphoniaDecoder.ts";
import type { SymphoniaDecoderHandle } from "../../../src/platform/audio/stream/SymphoniaDecoder.ts";
import assert from "node:assert/strict";

const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const SECONDS = 3;
const TOTAL_FRAMES = SAMPLE_RATE * SECONDS;

const fixtureDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

const wasmPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../src/platform/audio/wasm/symphonia/symphonia_bg.wasm",
);

await initSymphonia({
  module_or_path: new Uint8Array(readFileSync(wasmPath)).buffer,
});

const glue = {
  SymphoniaDecoder:
    (await import("../../../src/platform/audio/wasm/symphonia/symphonia.js"))
      .SymphoniaDecoder as new () => SymphoniaDecoderHandle,
};

const buildWavSine = (): Uint8Array => {
  const dataLength = TOTAL_FRAMES * CHANNELS * 2;
  const buffer = new Uint8Array(44 + dataLength);
  const view = new DataView(buffer.buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS * 2, true);
  view.setUint16(32, CHANNELS * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataLength, true);
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 0.5;
    const value = Math.round(sample * 32767);
    view.setInt16(44 + i * CHANNELS * 2, value, true);
    view.setInt16(44 + i * CHANNELS * 2 + 2, value, true);
  }
  return buffer;
};

interface DecodeResult {
  info: { sample_rate: number; channels: number; total_samples: bigint };
  frames: number;
  peak: number;
  emitted: number;
  ended: boolean;
}

const decodeThroughPump = async (
  bytes: Uint8Array,
  skipFrames = 0,
): Promise<DecodeResult> => {
  const chunks: Uint8Array[] = [];
  const split = Math.floor(bytes.length * 0.55);
  chunks.push(bytes.subarray(0, split), bytes.subarray(split));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  const emitted: Float32Array[] = [];
  let ended = false;
  let pumpError: Error | null = null;
  let info:
    | { sample_rate: number; channels: number; total_samples: bigint }
    | null = null;

  const pump = new FloStreamPump({
    url: "blob:fixture",
    decoder: createSymphoniaStreamingDecoder(glue),
    events: {
      onInfo: (i) => {
        info = i;
      },
      onChunk: (chunk) => emitted.push(chunk),
      onEnd: () => {
        ended = true;
      },
      onError: (error) => {
        pumpError = error;
      },
    },
    fetcher: async () => ({ ok: true, status: 200, body }),
  });

  await pump.start(skipFrames);
  assert.ok(emitted.length >= 1, "first block emitted");
  assert.strictEqual(pumpError, null, pumpError?.message);
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.strictEqual(info?.sample_rate, SAMPLE_RATE);
  assert.strictEqual(info?.channels, CHANNELS);
  assert.strictEqual(ended, true);

  const frames = emitted.reduce(
    (sum, chunk) => sum + chunk.length / CHANNELS,
    0,
  );
  let peak = 0;
  for (const chunk of emitted) {
    for (let i = 0; i < chunk.length; i++) {
      const value = Math.abs(chunk[i]!);
      if (value > peak) peak = value;
    }
  }
  return {
    info: info!,
    frames,
    peak,
    emitted: emitted.length,
    ended,
  };
};

const runFixture = async (fileName: string, skipFrames = 0) => {
  const bytes = readFileSync(path.join(fixtureDir, fileName));
  return decodeThroughPump(new Uint8Array(bytes), skipFrames);
};

interface StreamingResult {
  framesBeforeTail: number;
  totalFrames: number;
  peak: number;
}

const streamingDecode = async (
  bytes: Uint8Array,
  tailBytes: number,
): Promise<StreamingResult> => {
  const decoder = createSymphoniaStreamingDecoder(glue);
  const emitted: Float32Array[] = [];
  let framesBeforeTail = 0;

  const drain = () => {
    for (;;) {
      const frame = decoder.next_frame();
      if (frame != null && frame.length > 0) {
        emitted.push(frame);
        continue;
      }
      if (decoder.budget_exhausted()) continue;
      return; 
    }
  };

  const feedUpTo = (length: number) => {
    decoder.feed(bytes.subarray(0, length));
    drain();
    if (decoder.has_error()) {
      throw new Error(decoder.error_message() ?? "streaming decode failed");
    }
  };

  const cut = bytes.length - tailBytes;
  feedUpTo(cut);
  framesBeforeTail = emitted.reduce(
    (sum, chunk) => sum + chunk.length / CHANNELS,
    0,
  );

  decoder.feed(bytes.subarray(cut));
  decoder.end_of_input();
  drain();
  if (decoder.has_error()) {
    throw new Error(decoder.error_message() ?? "final decode failed");
  }

  const totalFrames = emitted.reduce(
    (sum, chunk) => sum + chunk.length / CHANNELS,
    0,
  );
  let peak = 0;
  for (const chunk of emitted) {
    for (let i = 0; i < chunk.length; i++) {
      const value = Math.abs(chunk[i]!);
      if (value > peak) peak = value;
    }
  }
  return { framesBeforeTail, totalFrames, peak };
};

const wavResult = await decodeThroughPump(buildWavSine());
assert.strictEqual(wavResult.info.total_samples, BigInt(TOTAL_FRAMES));
assert.strictEqual(wavResult.frames, TOTAL_FRAMES);
assert.ok(wavResult.peak > 0.05, `wav peak = ${wavResult.peak}`);

const alacResult = await runFixture("sine440-3s-alac.m4a");
assert.ok(Math.abs(alacResult.frames - TOTAL_FRAMES) < 64);
assert.ok(alacResult.peak > 0.05, `alac peak = ${alacResult.peak}`);

const aacResult = await runFixture("sine440-3s-aac.m4a");
assert.ok(aacResult.frames >= TOTAL_FRAMES - 64);
assert.ok(aacResult.frames <= TOTAL_FRAMES + 2112 + 64);
assert.ok(aacResult.peak > 0.05, `aac peak = ${aacResult.peak}`);

const adtsResult = await runFixture("sine440-3s-aac.aac");
assert.ok(adtsResult.frames >= TOTAL_FRAMES - 64);
assert.ok(adtsResult.frames <= TOTAL_FRAMES + 2112 + 64);

const flacResult = await runFixture("sine440-3s-flac.flac");
assert.ok(Math.abs(flacResult.frames - TOTAL_FRAMES) < 64);
assert.ok(flacResult.peak > 0.05, `flac peak = ${flacResult.peak}`);

const mp3Result = await runFixture("sine440-3s-mp3.mp3");
assert.ok(mp3Result.frames > TOTAL_FRAMES * 0.97);
assert.ok(mp3Result.peak > 0.05, `mp3 peak = ${mp3Result.peak}`);

const targetFrames = Math.floor(1.5 * SAMPLE_RATE);
const seekResult = await runFixture("sine440-3s-alac.m4a", targetFrames);
assert.strictEqual(seekResult.frames, TOTAL_FRAMES - targetFrames);

const flacBytes = readFileSync(path.join(fixtureDir, "sine440-3s-flac.flac"));
const flacStreaming = await streamingDecode(new Uint8Array(flacBytes), 4096);
assert.ok(
  flacStreaming.framesBeforeTail > 0,
  "flac decoded before end_of_input",
);
assert.ok(Math.abs(flacStreaming.totalFrames - flacResult.frames) < 64);

const alacBytes = readFileSync(path.join(fixtureDir, "sine440-3s-alac.m4a"));
const alacStreaming = await streamingDecode(new Uint8Array(alacBytes), 4096);
assert.strictEqual(
  alacStreaming.framesBeforeTail,
  0,
  "buffered m4a yields nothing until the moov atom arrives",
);
assert.ok(Math.abs(alacStreaming.totalFrames - alacResult.frames) < 64);

console.log(
  "symphonia E2E ok: wav/alac/aac/adts/flac/mp3 decoded through FloStreamPump; end_of_input + seek-slice + streaming-start verified",
);