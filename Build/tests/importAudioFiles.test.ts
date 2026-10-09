import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Track } from "../src/core/engine/types";

jest.mock("../src/platform/metadata", () => {
  const extractMetadata = jest.fn();
  return {
    createMetadataExtractor: jest.fn(() => ({ extractMetadata })),
    createFloMetadataExtractor: jest.fn(() => ({ extractMetadata })),
    compressAlbumArt: jest.fn(async (dataUrl: string) => dataUrl),
    generateUniqueId: jest.fn(() => "new-id"),
  };
});

jest.mock("../src/platform/storage/albumArt", () => ({
  dataUrlToBlob: (dataUrl: string) => new Blob([dataUrl]),
}));

jest.mock("../src/platform/storage", () => ({
  albumArtStorage: { save: jest.fn(async () => "art-id") },
  opfsAvailability: jest.fn(() => ({ available: true })),
}));

jest.mock("../src/platform/providers", () => ({
  AlbumArtManager: class {
    addProvider() {}
    async fetchAlbumArt() {
      return null;
    }
  },
  MusicBrainzProvider: class {},
  DiscogsProvider: class {},
}));

jest.mock("../src/platform/library/duplicateDetector", () => ({
  findTrackBySourcePath: jest.requireActual(
    "../src/platform/library/duplicateDetector",
  ).findTrackBySourcePath,
  createDuplicateDetector: jest.fn(() => ({
    findDuplicateTrack: jest.fn(async () => null),
  })),
}));

jest.mock("sonner", () => ({
  toast: {
    loading: jest.fn(),
    dismiss: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { importAudioFiles } from "../src/helpers/importAudioFiles";

const { createMetadataExtractor } = jest.requireMock(
  "../src/platform/metadata",
) as { createMetadataExtractor: jest.Mock };
const { albumArtStorage } = jest.requireMock("../src/platform/storage") as {
  albumArtStorage: { save: jest.Mock };
};
const { createDuplicateDetector } = jest.requireMock(
  "../src/platform/library/duplicateDetector",
) as { createDuplicateDetector: jest.Mock };

const translate = (key: string) => key;

const audioFile = (name: string) =>
  new File([new Uint8Array([1, 2, 3])], name, { type: "audio/mpeg" });

function existingFolderTrack(path: string, id = "existing"): Track {
  return {
    id,
    title: "Existing",
    artist: "Artist",
    album: "Album",
    duration: 1,
    url: "",
    hasStoredAudio: true,
    sourceKind: "folderHandle",
    sourceId: "dir-1",
    path,
  } as Track;
}

describe("importAudioFiles duplicate handling", () => {
  let extractMetadata: jest.Mock;
  let findDuplicateTrack: jest.Mock;
  let saveAlbumArt: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    extractMetadata = jest.fn(async () => ({
      title: "Title",
      artist: "Artist",
      album: "Album",
      duration: 1,
    }));
    createMetadataExtractor.mockReturnValue({ extractMetadata });
    findDuplicateTrack = jest.fn(async () => null);
    createDuplicateDetector.mockReturnValue({ findDuplicateTrack });
    saveAlbumArt = jest.fn(async () => "art-id");
    albumArtStorage.save = saveAlbumArt;
  });

  it("skips a file that is already in the library before reading its metadata", async () => {
    const candidates = [existingFolderTrack("album/a.mp3")];

    const result = await importAudioFiles(
      [{ file: audioFile("a.mp3"), path: "album/a.mp3" }],
      jest.fn(),
      translate,
      () => candidates,
      { sourceKind: "folderHandle", sourceId: "dir-1" },
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.successCount).toBe(0);
    expect(extractMetadata).not.toHaveBeenCalled();
    expect(result.songs[0]?.id).toBe("existing");
  });

  it("does not store album art for a file it skips as a duplicate", async () => {
    const candidates = [existingFolderTrack("album/a.mp3")];

    await importAudioFiles(
      [{ file: audioFile("a.mp3"), path: "album/a.mp3" }],
      jest.fn(),
      translate,
      () => candidates,
      { sourceKind: "folderHandle", sourceId: "dir-1" },
    );

    expect(saveAlbumArt).not.toHaveBeenCalled();
  });

  it("does not fall back to hashing when the source path already matches", async () => {
    const candidates = [existingFolderTrack("album/a.mp3")];

    await importAudioFiles(
      [{ file: audioFile("a.mp3"), path: "album/a.mp3" }],
      jest.fn(),
      translate,
      () => candidates,
      { sourceKind: "folderHandle", sourceId: "dir-1" },
    );

    expect(findDuplicateTrack).not.toHaveBeenCalled();
  });

  it("counts a file as new when the same path belongs to a different folder", async () => {
    const addSong = jest.fn();
    const candidates = [existingFolderTrack("album/a.mp3", "other-folder")];

    const result = await importAudioFiles(
      [{ file: audioFile("a.mp3"), path: "album/a.mp3" }],
      addSong,
      translate,
      () => candidates,
      { sourceKind: "folderHandle", sourceId: "dir-2" },
    );

    expect(result.successCount).toBe(1);
    expect(addSong).toHaveBeenCalled();
  });

  it("still reads metadata for a file with no path to match on", async () => {
    const addSong = jest.fn();
    const candidates = [existingFolderTrack("album/a.mp3")];

    const result = await importAudioFiles(
      [audioFile("a.mp3")],
      addSong,
      translate,
      () => candidates,
    );

    expect(extractMetadata).toHaveBeenCalledTimes(1);
    expect(result.successCount).toBe(1);
    expect(addSong).toHaveBeenCalled();
  });

  it("falls back to hashing when the path is not in the library", async () => {
    const addSong = jest.fn();

    await importAudioFiles(
      [{ file: audioFile("a.mp3"), path: "album/a.mp3" }],
      addSong,
      translate,
      () => [],
      { sourceKind: "folderHandle", sourceId: "dir-1" },
    );

    expect(extractMetadata).toHaveBeenCalledTimes(1);
    expect(findDuplicateTrack).toHaveBeenCalledTimes(1);
  });

  it("reports the skipped count up front instead of only at the end", async () => {
    const candidates = [
      existingFolderTrack("a.mp3", "one"),
      existingFolderTrack("b.mp3", "two"),
    ];
    const { toast } = jest.requireMock("sonner") as {
      toast: Record<string, jest.Mock>;
    };

    await importAudioFiles(
      [
        { file: audioFile("a.mp3"), path: "a.mp3" },
        { file: audioFile("b.mp3"), path: "b.mp3" },
      ],
      jest.fn(),
      translate,
      () => candidates,
      { sourceKind: "folderHandle", sourceId: "dir-1" },
    );

    expect(toast.loading).not.toHaveBeenCalled();
  });

  it("still catches a duplicate created earlier in the same run", async () => {
    const candidates: Track[] = [];
    const addSong = jest.fn(async (song: Track) => {
      candidates.push(song);
    });

    const result = await importAudioFiles(
      [
        { file: audioFile("a.mp3"), path: "album/a.mp3" },
        { file: audioFile("a.mp3"), path: "album/a.mp3" },
      ],
      addSong,
      translate,
      () => candidates,
      { sourceKind: "folderHandle", sourceId: "dir-1" },
    );

    expect(result.successCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });
});
