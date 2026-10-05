import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { trackStorage } from "../src/platform/storage/trackStorage";
import { loadAudio } from "../src/platform/storage/opfs";
import type { Track } from "../src/core/engine/types";

jest.mock("../src/platform/storage/opfs", () => ({
  loadAudio: jest.fn(),
  deleteAudio: jest.fn(),
  saveAudio: jest.fn(),
}));

const mockedLoadAudio = jest.mocked(loadAudio);

const makeTrack = (id: string, mimeType = "audio/mpeg"): Track => ({
  id,
  title: "Song",
  artist: "Artist",
  album: "Album",
  duration: 3,
  url: "",
  mimeType,
  hasStoredAudio: true,
});

function readAllBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("trackStorage.reconstructUrl", () => {
  let urls: string[];

  beforeEach(() => {
    urls = [];
    mockedLoadAudio.mockReset();
    mockedLoadAudio.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])]));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => {
        const url = `blob:test-${urls.length}`;
        urls.push(url);
        return url;
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the same blob URL across repeated calls for unchanged data", async () => {
    const track = makeTrack("reuse-id");

    const first = await trackStorage.reconstructUrl(track);
    const second = await trackStorage.reconstructUrl(track);

    expect(first.url).toBe(second.url);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockedLoadAudio).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("reuses the cached URL when called concurrently with identical data", async () => {
    const track = makeTrack("concurrent-id");

    const [first, second] = await Promise.all([
      trackStorage.reconstructUrl(track),
      trackStorage.reconstructUrl(track),
    ]);

    expect(first.url).toBe(second.url);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockedLoadAudio).toHaveBeenCalledTimes(1);
  });

  it("creates a new URL and revokes the old one when the cache is invalidated", async () => {
    const track = makeTrack("changed-id");
    const first = await trackStorage.reconstructUrl(track);

    trackStorage.revokeAudioUrl(track.id);
    mockedLoadAudio.mockResolvedValue(new Blob([new Uint8Array([9, 9, 9, 9])]));

    const second = await trackStorage.reconstructUrl(track);

    expect(first.url).not.toBe(second.url);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.url);
  });

  it("leaves a non-stored track untouched", async () => {
    const track = makeTrack("stream-id");
    track.hasStoredAudio = false;

    const result = await trackStorage.reconstructUrl(track);

    expect(result.url).toBe("");
    expect(mockedLoadAudio).not.toHaveBeenCalled();
  });

  it("returns the track unchanged when OPFS has no audio", async () => {
    mockedLoadAudio.mockResolvedValue(null);
    const track = makeTrack("missing-id");

    const result = await trackStorage.reconstructUrl(track);

    expect(result.url).toBe("");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("stamps the track MIME type onto the typeless blob from OPFS", async () => {
    mockedLoadAudio.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])]));
    const track = makeTrack("typed-id", "audio/x-caf");

    await trackStorage.reconstructUrl(track);

    const passed = jest.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(passed.type).toBe("audio/x-caf");
  });

  it("stamps the MIME type without altering the audio bytes", async () => {
    const bytes = new Uint8Array([9, 8, 7, 6, 5]);
    mockedLoadAudio.mockResolvedValue(new Blob([bytes]));
    const track = makeTrack("bytes-id", "audio/mpeg");

    await trackStorage.reconstructUrl(track);

    const passed = jest.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(passed.size).toBe(bytes.length);
    expect(await readAllBytes(passed)).toEqual(bytes);
  });

  it("keeps an existing blob type rather than overwriting it", async () => {
    mockedLoadAudio.mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: "audio/x-caf" }),
    );
    const track = makeTrack("preset-id", "audio/mpeg");

    await trackStorage.reconstructUrl(track);

    const passed = jest.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(passed.type).toBe("audio/x-caf");
  });

  it("leaves the blob untyped when the track records no MIME type", async () => {
    mockedLoadAudio.mockResolvedValue(new Blob([new Uint8Array([1])]));
    const track = makeTrack("untyped-id", "");
    track.mimeType = undefined;

    await trackStorage.reconstructUrl(track);

    const passed = jest.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(passed.type).toBe("");
  });
});
