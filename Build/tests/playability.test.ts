import { describeAudio, codecPlayabilityFailure } from "../src/platform/audio/playability";
import { describe, it, expect, afterEach } from "@jest/globals";

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

describe("describeAudio", () => {
  it("detects wav container from RIFF header", () => {
    const bytes = new Uint8Array(64);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    bytes.set([0x57, 0x41, 0x56, 0x45], 8);
    const descriptor = describeAudio(bytes);
    expect(descriptor.container).toBe("wav");
    expect(descriptor.audioCodec).toBe("WAVE");
  });

  it("detects flac from fLaC magic", () => {
    const bytes = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(describeAudio(bytes)).toEqual({ container: "flac", audioCodec: "flac" });
  });

  it("detects ogg from OggS magic", () => {
    const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(describeAudio(bytes).container).toBe("ogg");
  });

  it("detects mp3 from an ID3 tag", () => {
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const descriptor = describeAudio(bytes);
    expect(descriptor.container).toBe("mpeg");
    expect(descriptor.audioCodec).toBe("mp3");
  });

  it("detects mp3 from an MPEG frame sync", () => {
    const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(describeAudio(bytes).container).toBe("mpeg");
  });

  it("detects alac codec inside an m4a ftyp container", () => {
    const bytes = new Uint8Array(16 * 1024);
    bytes.set([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20], 0);
    bytes.set([0x61, 0x6c, 0x61, 0x63], 4096);
    const descriptor = describeAudio(bytes);
    expect(descriptor.container).toBe("mp4");
    expect(descriptor.audioCodec).toBe("alac");
  });

  it("detects mp4a (aac) codec inside an m4a container", () => {
    const bytes = new Uint8Array(16 * 1024);
    bytes.set([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20], 0);
    bytes.set([0x6d, 0x70, 0x34, 0x61], 2048);
    const descriptor = describeAudio(bytes);
    expect(descriptor.container).toBe("mp4");
    expect(descriptor.audioCodec).toBe("mp4a");
  });

  it("returns unknown for unrecognized data", () => {
    const bytes = fromHex("deadbeefcafebabe0001020304050607");
    expect(describeAudio(bytes)).toEqual({ container: "unknown", audioCodec: null });
  });
});

describe("codecPlayabilityFailure", () => {
  const originalCreateElement = document.createElement.bind(document);

  afterEach(() => {
    document.createElement = originalCreateElement;
  });

  it("flags alac as unsupported when canPlayType is empty", () => {
    document.createElement = (tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === "audio") {
        Object.defineProperty(element, "canPlayType", {
          value: () => "",
        });
      }
      return element;
    };
    const failure = codecPlayabilityFailure("alac");
    expect(failure).not.toBeNull();
    expect(failure?.codecName).toBe("Apple Lossless (ALAC)");
  });

  it("allows alac when the browser declares support", () => {
    document.createElement = (tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === "audio") {
        Object.defineProperty(element, "canPlayType", {
          value: () => "maybe",
        });
      }
      return element;
    };
    expect(codecPlayabilityFailure("alac")).toBeNull();
  });

  it("returns null for supported codecs", () => {
    expect(codecPlayabilityFailure("mp3")).toBeNull();
    expect(codecPlayabilityFailure("flac")).toBeNull();
    expect(codecPlayabilityFailure("aac")).toBeNull();
  });

  it("returns null for empty codec", () => {
    expect(codecPlayabilityFailure("")).toBeNull();
  });
});