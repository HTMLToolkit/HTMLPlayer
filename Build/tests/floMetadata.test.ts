import { describe, it, expect, jest } from "@jest/globals";
import {
  FloMetadataExtractor,
  type FloLibApi,
} from "../src/platform/metadata/floMetadata";

const createFile = (bytes = 40960, name = "sample.flo"): File => {
  const file = new File([new Uint8Array(bytes)], name, { type: "audio/flo" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new Uint8Array(bytes).buffer,
  });
  return file;
};

const makeFloLib = (): FloLibApi & {
  info: jest.Mock;
  getMetadata: jest.Mock;
  getCoverArt: jest.Mock;
  init: jest.Mock;
} => ({
  init: jest.fn(async () => undefined),
  info: jest.fn(() => ({})),
  getMetadata: jest.fn(() => null),
  getCoverArt: jest.fn(() => null),
});

describe("FloMetadataExtractor", () => {
  it("maps tags and codec info fields from the real wasm api", async () => {
    const flo = makeFloLib();
    flo.info.mockReturnValue({
      sample_rate: 48000,
      channels: 1,
      bit_depth: 24,
      duration_secs: 3.5,
      total_samples: 168000n,
    });
    flo.getMetadata.mockReturnValue({
      title: "Song Title",
      artist: "Song Artist",
      album: "Song Album",
    });

    const metadata = await new FloMetadataExtractor(flo).extractMetadata(
      createFile(),
    );

    expect(metadata.title).toBe("Song Title");
    expect(metadata.artist).toBe("Song Artist");
    expect(metadata.album).toBe("Song Album");
    expect(metadata.duration).toBe(3.5);
    expect(metadata.encoding).toEqual({
      sampleRate: 48000,
      channels: 1,
      bitsPerSample: 24,
      lossless: true,
    });
  });

  it("falls back to filename and unknown placeholders when tags are absent", async () => {
    const flo = makeFloLib();
    flo.info.mockReturnValue({
      sample_rate: 44100,
      channels: 2,
      bit_depth: 16,
      duration_secs: 2,
      total_samples: 88200n,
    });

    const metadata = await new FloMetadataExtractor(flo).extractMetadata(
      createFile(),
    );

    expect(metadata.title).toBe("sample");
    expect(metadata.artist).toBe("Unknown Artist");
    expect(metadata.album).toBe("Unknown Album");
  });

  it("derives duration from total_samples when duration_secs is missing", async () => {
    const flo = makeFloLib();
    flo.info.mockReturnValue({
      sample_rate: 44100,
      channels: 2,
      bit_depth: 16,
      duration_secs: 0,
      total_samples: 1102500n,
    });

    const metadata = await new FloMetadataExtractor(flo).extractMetadata(
      createFile(),
    );

    expect(metadata.duration).toBe(25);
  });

  it("derives duration from byte length when audio info is sparse", async () => {
    const flo = makeFloLib();
    flo.info.mockReturnValue({
      sample_rate: 44100,
      channels: 2,
      bit_depth: 16,
      duration_secs: 0,
      total_samples: 0n,
    });

    const metadata = await new FloMetadataExtractor(flo).extractMetadata(
      createFile(40960),
    );

    expect(metadata.duration).toBe(40960 / 2 / (44100 * 2));
  });

  it("re-initializes when init fails and extraction recovers", async () => {
    const flo = makeFloLib();
    flo.init.mockRejectedValueOnce(new Error("wasm fetch failed"));
    flo.info.mockReturnValue({
      sample_rate: 44100,
      channels: 2,
      bit_depth: 16,
      duration_secs: 1,
      total_samples: 44100n,
    });

    const extractor = new FloMetadataExtractor(flo);

    await expect(extractor.extractMetadata(createFile())).rejects.toThrow(
      "wasm fetch failed",
    );

    const metadata = await extractor.extractMetadata(createFile());
    expect(metadata.duration).toBe(1);
    expect(flo.init).toHaveBeenCalledTimes(2);
  });

  it("returns defaults when extraction fails", async () => {
    const flo = makeFloLib();
    flo.info.mockImplementation(() => {
      throw new Error("corrupt flo");
    });

    const metadata = await new FloMetadataExtractor(flo).extractMetadata(
      createFile(40960, "corrupt.flo"),
    );

    expect(metadata.title).toBe("corrupt");
    expect(metadata.artist).toBe("Unknown Artist");
    expect(metadata.album).toBe("Unknown Album");
    expect(metadata.duration).toBe(0);
  });

  it("returns album art as a base64 data url when a cover is embedded", async () => {
    const flo = makeFloLib();
    flo.getCoverArt.mockReturnValue({
      mime_type: "image/jpeg",
      data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    });

    const metadata = await new FloMetadataExtractor(flo).extractMetadata(
      createFile(),
    );

    expect(metadata.albumArt).toBe(
      `data:image/jpeg;base64,${btoa("\xff\xd8\xff\xe0\u0000\u0010")}`,
    );
  });

  it("omits album art when no cover is embedded", async () => {
    const flo = makeFloLib();
    flo.getCoverArt.mockReturnValue(null);

    const metadata = await new FloMetadataExtractor(flo).extractMetadata(
      createFile(),
    );

    expect(metadata.albumArt).toBeUndefined();
  });

  it("omits album art when the embedded cover is not an image", async () => {
    const flo = makeFloLib();
    flo.getCoverArt.mockReturnValue({
      mime_type: "application/octet-stream",
      data: new Uint8Array([1, 2, 3]),
    });

    const metadata = await new FloMetadataExtractor(flo).extractMetadata(
      createFile(),
    );

    expect(metadata.albumArt).toBeUndefined();
  });
});