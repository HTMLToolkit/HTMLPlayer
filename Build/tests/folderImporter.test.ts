import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  importFolderFiles,
  importFolderHandle,
  syncAllDirectories,
  type FolderImportOpts,
} from "../src/platform/storage/folderImporter";
import { isDirectoryPickerSupported } from "../src/platform/storage/directoryHandle";
import {
  directoryStore,
  reindexDirectory,
  upsertDirectory,
} from "../src/platform/storage/directoryStore";
import { importAudioFiles } from "../src/helpers/importAudioFiles";
import { generateUniqueId } from "../src/platform/metadata";
import type { Track } from "../src/core/engine/types";

jest.mock("../src/platform/storage/directoryStore", () => ({
  directoryStore: {
    save: jest.fn(),
    get: jest.fn(),
    loadAll: jest.fn(),
  },
  upsertDirectory: jest.fn(),
  reindexDirectory: jest.fn(),
}));

jest.mock("../src/helpers/importAudioFiles", () => ({
  importAudioFiles: jest.fn(),
}));

jest.mock("../src/platform/metadata", () => ({
  generateUniqueId: jest.fn(() => "generated-id"),
}));

jest.mock("../src/platform/storage/opfs", () => ({
  ensureStoragePersistent: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() },
}));

const mockedDirectoryStore = jest.mocked(directoryStore);
const mockedImportAudioFiles = jest.mocked(importAudioFiles);
const mockedGenerateUniqueId = jest.mocked(generateUniqueId);
const mockedUpsertDirectory = jest.mocked(upsertDirectory);
const mockedReindexDirectory = jest.mocked(reindexDirectory);

interface FakeFileEntry {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
}

interface FakeDirectory {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<FakeFileEntry | FakeDirectory>;
  queryPermission: (descriptor: { mode: string }) => Promise<PermissionState>;
  requestPermission: (descriptor: { mode: string }) => Promise<PermissionState>;
}

type FakeEntry = FakeFileEntry | FakeDirectory;

const fileEntry = (name: string, contents = "audio"): FakeFileEntry => ({
  kind: "file",
  name,
  getFile: () =>
    Promise.resolve(
      new File([contents], name, { type: "audio/mpeg" }),
    ),
});

const directory = (
  name: string,
  entries: FakeEntry[],
  permission: PermissionState = "granted",
): FakeDirectory => ({
  kind: "directory",
  name,
  values: () => ({
    async *[Symbol.asyncIterator]() {
      for (const entry of entries) {
        yield entry;
      }
    },
  }),
  queryPermission: () => Promise.resolve(permission),
  requestPermission: () => Promise.resolve(permission),
});

const makeTrack = (id: string, sourceId: string, path: string): Track => ({
  id,
  title: id,
  artist: "Artist",
  album: "Album",
  duration: 1,
  url: "",
  mimeType: "audio/mpeg",
  hasStoredAudio: true,
  sourceKind: "folderHandle",
  sourceId,
  path,
});

const translate = (key: string): string => key;

describe("folderImporter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGenerateUniqueId.mockReturnValue("generated-id");
    mockedDirectoryStore.loadAll.mockResolvedValue([]);
    mockedDirectoryStore.get.mockResolvedValue(null);
    mockedUpsertDirectory.mockImplementation(
      async (name: string, handle: unknown, id?: string) => ({
        id: id ?? "generated-id",
        name,
        handle,
        entries: {},
      }),
    );
    mockedReindexDirectory.mockResolvedValue(undefined);
    mockedImportAudioFiles.mockResolvedValue({
      successCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      songs: [],
    });
  });

  it("imports nested audio files with relative paths and a folderHandle context", async () => {
    const handle = directory("Music", [
      directory("Album A", [fileEntry("01 Song.mp3"), fileEntry("cover.jpg")]),
      fileEntry("loose.flac"),
    ]);
    const opts: FolderImportOpts = {
      t: translate,
      addSong: jest.fn(async () => undefined),
    };

    const result = await importFolderHandle(handle, opts);

    expect(result).toEqual({ dirId: "generated-id", added: 0, removed: 0 });
    expect(mockedImportAudioFiles).toHaveBeenCalledTimes(1);

    const [items, , , , context] = mockedImportAudioFiles.mock.calls[0];
    expect(items).toEqual([
      { file: expect.any(File), path: "Album A/01 Song.mp3" },
      { file: expect.any(File), path: "loose.flac" },
    ]);
    expect(context).toEqual({
      sourceKind: "folderHandle",
      sourceId: "generated-id",
    });
  });

  it("persists the directory handle before importing and reuses a known directory id", async () => {
    const handle = directory("Music", [fileEntry("song.mp3")]);

    const result = await importFolderHandle(handle, {
      t: translate,
      addSong: jest.fn(async () => undefined),
    });

    expect(result.dirId).toBe("generated-id");
    expect(mockedUpsertDirectory).toHaveBeenCalledWith("Music", handle, undefined);
    const upsertOrder = mockedUpsertDirectory.mock.invocationCallOrder[0] as number;
    const importOrder = mockedImportAudioFiles.mock.invocationCallOrder[0] as number;
    expect(upsertOrder).toBeLessThan(importOrder);
  });

  it("removes songs whose files are gone and reindexes the surviving entries", async () => {
    const handle = directory("Music", [fileEntry("kept.mp3")]);
    const stored = {
      id: "dir-1",
      name: "Music",
      handle,
      entries: { "kept.mp3": "song-kept", "gone.mp3": "song-gone" },
    };
    const tracks = [makeTrack("song-kept", "dir-1", "kept.mp3")];
    const removeSong = jest.fn();

    const result = await importFolderHandle(
      handle,
      {
        t: translate,
        addSong: jest.fn(async () => undefined),
        getExistingTracks: () => tracks,
        removeSong,
      },
      stored,
    );

    expect(result.removed).toBe(1);
    expect(removeSong).toHaveBeenCalledWith("song-gone");
    expect(mockedReindexDirectory).toHaveBeenCalledWith("dir-1", tracks);
  });

  it("removes every stale track when a folder no longer has any audio", async () => {
    const handle = directory("Music", []);
    const stored = {
      id: "dir-1",
      name: "Music",
      handle,
      entries: { "gone.mp3": "song-1", "also-gone.flac": "song-2" },
    };
    const removeSong = jest.fn();

    const result = await importFolderHandle(
      handle,
      {
        t: translate,
        addSong: jest.fn(async () => undefined),
        getExistingTracks: () => [],
        removeSong,
      },
      stored,
    );

    expect(result).toEqual({ dirId: "dir-1", added: 0, removed: 2 });
    expect(removeSong).toHaveBeenCalledWith("song-1");
    expect(removeSong).toHaveBeenCalledWith("song-2");
    expect(mockedReindexDirectory).toHaveBeenCalledWith("dir-1", []);
  });

  it("aborts without touching storage when read permission is denied", async () => {
    const handle = directory("Locked", [fileEntry("song.mp3")], "denied");

    const result = await importFolderHandle(handle, {
      t: translate,
      addSong: jest.fn(async () => undefined),
    });

    expect(result).toEqual({ dirId: "", added: 0, removed: 0 });
    expect(mockedDirectoryStore.save).not.toHaveBeenCalled();
    expect(mockedImportAudioFiles).not.toHaveBeenCalled();
  });

  it("stores an empty directory so later imports can reuse the handle", async () => {
    const handle = directory("Empty", []);

    const result = await importFolderHandle(handle, {
      t: translate,
      addSong: jest.fn(async () => undefined),
    });

    expect(result).toEqual({ dirId: "generated-id", added: 0, removed: 0 });
    expect(mockedImportAudioFiles).not.toHaveBeenCalled();
    expect(mockedUpsertDirectory).toHaveBeenCalledWith("Empty", handle, undefined);
  });

  it("syncs only directories whose permission is still granted", async () => {
    const granted = directory("Granted", [fileEntry("song.mp3")]);
    const prompt = directory("NeedsPrompt", [fileEntry("other.mp3")], "prompt");
    mockedDirectoryStore.loadAll.mockResolvedValue([
      { id: "dir-a", name: "Granted", handle: granted, entries: {} },
      { id: "dir-b", name: "NeedsPrompt", handle: prompt, entries: {} },
    ]);
    mockedImportAudioFiles.mockResolvedValue({
      successCount: 2,
      duplicateCount: 0,
      errorCount: 0,
      songs: [],
    });

    await syncAllDirectories({
      t: translate,
      addSong: jest.fn(async () => undefined),
      silent: true,
    });

    expect(mockedImportAudioFiles).toHaveBeenCalledTimes(1);
    const [items, , , , context] = mockedImportAudioFiles.mock.calls[0];
    expect(context).toEqual({
      sourceKind: "folderHandle",
      sourceId: "dir-a",
    });
    expect(items).toEqual([{ file: expect.any(File), path: "song.mp3" }]);
  });

  it("imports webkitdirectory files without a handle context so they are copied to OPFS", async () => {
    const file = new File(["audio"], "01 Song.mp3", { type: "audio/mpeg" });
    Object.defineProperty(file, "webkitRelativePath", {
      value: "Album A/01 Song.mp3",
    });

    const result = await importFolderFiles([file], {
      t: translate,
      addSong: jest.fn(async () => undefined),
    });

    expect(result).toEqual({ imported: 0 });
    const [items, , , , context] = mockedImportAudioFiles.mock.calls[0];
    expect(items).toEqual([{ file, path: "Album A/01 Song.mp3" }]);
    expect(context).toBeUndefined();
  });

  it("reports directory picker support from the window API", () => {
    expect(isDirectoryPickerSupported()).toBe(false);

    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: () => Promise.resolve(null),
    });

    expect(isDirectoryPickerSupported()).toBe(true);

    Reflect.deleteProperty(window, "showDirectoryPicker");
  });
});
