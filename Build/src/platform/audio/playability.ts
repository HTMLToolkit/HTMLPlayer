import type { Track } from "../../core/engine/types";

const SNIFF_HEAD_SIZE = 262144;
const SNIFF_TAIL_SIZE = 262144;

const CODEC_DISPLAY: Record<string, string> = {
  alac: "Apple Lossless (ALAC)",
  dsd: "DSD",
  dsf: "DSD",
  dff: "DSD",
};

const UNSUPPORTED_CODECS = new Set(["alac", "dsd", "dsf", "dff"]);

const CODEC_BROWSER_MIME: Record<string, string> = {
  alac: 'audio/mp4; codecs="alac"',
};

export interface AudioDescriptor {
  container: "mpeg" | "flac" | "wav" | "mp4" | "ogg" | "aiff" | "unknown";
  audioCodec: string | null;
}

export interface CodecFailure {
  codecName: string;
  browser: string;
}

function browserCanPlayMime(spec: string): boolean {
  if (typeof document === "undefined") return true;
  const probe = document.createElement("audio");
  return probe.canPlayType(spec) !== "";
}

function asAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = offset; i < offset + length && i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) break;
    out += String.fromCharCode(byte);
  }
  return out;
}

function indexOfAscii(haystack: Uint8Array, needle: string): number {
  const needleLength = needle.length;
  outer: for (let i = 0; i <= haystack.length - needleLength; i++) {
    for (let j = 0; j < needleLength; j++) {
      if (haystack[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

function detectMp4Codec(scan: Uint8Array): string | null {
  const fourccs = ["alac", "mp4a", "ac-3", "ec-3", "Opus", "samr"];
  let detected: string | null = null;
  let bestDistance = Infinity;
  for (const fourcc of fourccs) {
    const index = indexOfAscii(scan, fourcc);
    if (index >= 0 && index < bestDistance) {
      bestDistance = index;
      detected = fourcc;
    }
  }
  return detected;
}

export function describeAudio(bytes: Uint8Array): AudioDescriptor {
  if (bytes.length < 16) {
    return { container: "unknown", audioCodec: null };
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return { container: "wav", audioCodec: asAscii(bytes, 8, 4) };
  }

  if (asAscii(bytes, 0, 4) === "fLaC") {
    return { container: "flac", audioCodec: "flac" };
  }

  if (asAscii(bytes, 0, 4) === "OggS") {
    return { container: "ogg", audioCodec: null };
  }

  if (asAscii(bytes, 0, 4) === "FORM") {
    return { container: "aiff", audioCodec: null };
  }

  const first = bytes[0];
  const second = bytes[1];
  if (
    asAscii(bytes, 0, 3) === "ID3" ||
    (first === 0xff && second !== undefined && (second & 0xe0) === 0xe0)
  ) {
    return { container: "mpeg", audioCodec: "mp3" };
  }

  if (asAscii(bytes, 4, 4) === "ftyp") {
    return { container: "mp4", audioCodec: detectMp4Codec(bytes) };
  }

  return { container: "unknown", audioCodec: null };
}

function detectBrowserName(): string {
  if (typeof navigator === "undefined") return "this browser";
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/")) return "Safari";
  return "this browser";
}

export function codecPlayabilityFailure(codec: string): CodecFailure | null {
  const normalized = codec.toLowerCase();
  if (!UNSUPPORTED_CODECS.has(normalized)) return null;

  const mimeSpec = CODEC_BROWSER_MIME[normalized];
  if (mimeSpec && browserCanPlayMime(mimeSpec)) return null;

  return {
    codecName: CODEC_DISPLAY[normalized] ?? normalized,
    browser: detectBrowserName(),
  };
}

export function trackCodecFailure(track: Track): CodecFailure | null {
  const codec = track.encoding?.codec;
  return codec ? codecPlayabilityFailure(codec) : null;
}

export async function sniffAudioFailure(
  url: string,
): Promise<CodecFailure | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const head = await blob.slice(0, SNIFF_HEAD_SIZE).arrayBuffer();
    const tail = await blob.slice(-SNIFF_TAIL_SIZE).arrayBuffer();
    const bytes = new Uint8Array(head.byteLength + tail.byteLength);
    bytes.set(new Uint8Array(head), 0);
    bytes.set(new Uint8Array(tail), head.byteLength);

    const descriptor = describeAudio(bytes);
    if (!descriptor.audioCodec) return null;
    return codecPlayabilityFailure(descriptor.audioCodec);
  } catch {
    return null;
  }
}
