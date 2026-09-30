import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { storeImportedSong } from "../src/helpers/addSong";
import { saveAudio } from "../src/platform/storage/opfs";
import { trackStorage } from "../src/platform/storage/trackStorage";
import type { Track } from "../src/core/engine/types";

jest.mock("../src/platform/storage/opfs", () => ({
  saveAudio: jest.fn(),
}));

jest.mock("../src/platform/storage/trackStorage", () => ({
  trackStorage: {
    saveTrack: jest.fn(),
  },
}));

const mockedSaveAudio = jest.mocked(saveAudio);
const mockedSaveTrack = jest.mocked(trackStorage.saveTrack);

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "song-1",
  title: "Song",
  artist: "Artist",
  album: "Album",
  duration: 1,
  url: "",
  mimeType: "audio/mpeg",
  hasStoredAudio: false,
  ...overrides,
});

const file = () => new File(["audio"], "01 Song.mp3", { type: "audio/mpeg" });

describe("storeImportedSong", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSaveAudio.mockResolvedValue(undefined);
    mockedSaveTrack.mockResolvedValue(undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:opfs-url"),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps a folder-handle import as a reference without copying to OPFS", async () => {
    const song = makeTrack({ path: "Album A/01 Song.mp3" });

    const stored = await storeImportedSong(song, file(), {
      sourceKind: "folderHandle",
      sourceId: "dir-1",
    });

    expect(mockedSaveAudio).not.toHaveBeenCalled();
    expect(stored.sourceKind).toBe("folderHandle");
    expect(stored.sourceId).toBe("dir-1");
    expect(stored.path).toBe("Album A/01 Song.mp3");
    expect(stored.hasStoredAudio).toBe(true);
    expect(stored.url).toBe("");
    expect(mockedSaveTrack).toHaveBeenCalledWith(stored);
  });

  it("prefers the path carried on the import context", async () => {
    const song = makeTrack({ path: "stale.mp3" });

    const stored = await storeImportedSong(song, file(), {
      sourceKind: "folderHandle",
      sourceId: "dir-1",
      path: "Album A/01 Song.mp3",
    });

    expect(mockedSaveAudio).not.toHaveBeenCalled();
    expect(stored.path).toBe("Album A/01 Song.mp3");
  });

  it("copies to OPFS when a folder handle has no usable path", async () => {
    const song = makeTrack();

    const stored = await storeImportedSong(song, file(), {
      sourceKind: "folderHandle",
      sourceId: "dir-1",
    });

    expect(mockedSaveAudio).toHaveBeenCalledWith("song-1", expect.any(File));
    expect(stored.url).toBe("blob:opfs-url");
  });

  it("copies to OPFS for a webkitdirectory import with no context", async () => {
    const song = makeTrack({ path: "Album A/01 Song.mp3" });

    const stored = await storeImportedSong(song, file());

    expect(mockedSaveAudio).toHaveBeenCalledWith("song-1", expect.any(File));
    expect(stored.hasStoredAudio).toBe(true);
    expect(stored.path).toBe("Album A/01 Song.mp3");
  });

  it("falls back to OPFS when the source kind is unknown", async () => {
    const song = makeTrack({ path: "a.mp3" });

    await storeImportedSong(song, file(), {
      sourceKind: "opfs",
      path: "a.mp3",
    });

    expect(mockedSaveAudio).toHaveBeenCalledWith("song-1", expect.any(File));
  });
});
