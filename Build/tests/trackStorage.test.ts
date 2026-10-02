import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
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

describe("trackStorage.reconstructUrl", () => {
  let urls: string[];

  beforeEach(() => {
    urls = [];
    mockedLoadAudio.mockReset();
    mockedLoadAudio.mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])]),
    );
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
    mockedLoadAudio.mockResolvedValue(
      new Blob([new Uint8Array([9, 9, 9, 9])]),
    );

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
});