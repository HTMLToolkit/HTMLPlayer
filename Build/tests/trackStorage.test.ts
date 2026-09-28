import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { trackStorage } from "../src/platform/storage/trackStorage";
import type { Track } from "../src/core/engine/types";

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
    jest
      .spyOn(trackStorage, "getAudioData")
      .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
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
  });

  it("creates a new URL and revokes the old one when stored audio changes", async () => {
    const track = makeTrack("changed-id");
    const first = await trackStorage.reconstructUrl(track);

    const newData = new Uint8Array([9, 9, 9, 9]).buffer;
    jest
      .spyOn(trackStorage, "getAudioData")
      .mockResolvedValue(newData);

    const second = await trackStorage.reconstructUrl(track);

    expect(first.url).not.toBe(second.url);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.url);
  });
});