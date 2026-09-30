import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  commonFolderSourceId,
  exportPlaylistToM3u,
} from "../src/platform/storage/m3uExport";
import {
  ensureWritePermission,
  pickWritableDirectory,
  writeTextFileToDirectory,
  type FsDirectoryHandle,
  type FsFileHandle,
} from "../src/platform/storage/directoryHandle";
import type { Playlist, Track } from "../src/core/engine/types";

function track(overrides: Partial<Track>): Track {
  return {
    id: "id",
    title: "Title",
    artist: "Artist",
    album: "Album",
    duration: 100,
    url: "",
    ...overrides,
  };
}

function playlist(songs: Track[]): Playlist {
  return { id: "p", name: "Mix", songs };
}

describe("exportPlaylistToM3u", () => {
  it("writes folder tracks using their existing relative path", () => {
    const result = exportPlaylistToM3u(
      playlist([
        track({
          id: "1",
          sourceKind: "folderHandle",
          sourceId: "dir-1",
          path: "Album/01 Song.mp3",
        }),
      ]),
    );

    expect(result.entryCount).toBe(1);
    expect(result.skipped).toHaveLength(0);
    expect(result.text).toContain("Album/01 Song.mp3");
  });

  it("keeps remote entries as absolute urls", () => {
    const result = exportPlaylistToM3u(
      playlist([track({ id: "1", url: "https://example.com/stream.mp3" })]),
    );

    expect(result.entryCount).toBe(1);
    expect(result.text).toContain("https://example.com/stream.mp3");
  });

  it("reports opfs tracks as unresolvable instead of writing a dead reference", () => {
    const result = exportPlaylistToM3u(
      playlist([track({ id: "1", sourceKind: "opfs", hasStoredAudio: true })]),
    );

    expect(result.entryCount).toBe(0);
    expect(result.skipped).toEqual([
      { id: "1", name: "Title", reason: "noLocation" },
    ]);
    expect(result.text.trim()).toBe("#EXTM3U");
  });

  it("reports an opfs-only playlist as empty so nothing is written", () => {
    const result = exportPlaylistToM3u(
      playlist([
        track({ id: "1", sourceKind: "opfs" }),
        track({ id: "2", sourceKind: "opfs" }),
      ]),
    );

    expect(result.entryCount).toBe(0);
    expect(result.skipped).toHaveLength(2);
  });

  it("skips blob urls, which are revoked and unresolvable outside the app", () => {
    const result = exportPlaylistToM3u(
      playlist([track({ id: "1", url: "blob:https://app/abc" })]),
    );

    expect(result.entryCount).toBe(0);
    expect(result.skipped).toHaveLength(1);
  });

  it("mixes resolvable and unresolvable tracks", () => {
    const result = exportPlaylistToM3u(
      playlist([
        track({
          id: "1",
          sourceKind: "folderHandle",
          sourceId: "dir-1",
          path: "Song.mp3",
        }),
        track({ id: "2", sourceKind: "opfs" }),
        track({ id: "3", url: "https://example.com/a.mp3" }),
      ]),
    );

    expect(result.entryCount).toBe(2);
    expect(result.skipped.map((item) => item.id)).toEqual(["2"]);
  });
});

describe("commonFolderSourceId", () => {
  it("returns the single shared folder source id", () => {
    const id = commonFolderSourceId(
      playlist([
        track({ id: "1", sourceKind: "folderHandle", sourceId: "dir-1" }),
        track({ id: "2", sourceKind: "folderHandle", sourceId: "dir-1" }),
      ]),
    );

    expect(id).toBe("dir-1");
  });

  it("returns null when tracks span several folders", () => {
    const id = commonFolderSourceId(
      playlist([
        track({ id: "1", sourceKind: "folderHandle", sourceId: "dir-1" }),
        track({ id: "2", sourceKind: "folderHandle", sourceId: "dir-2" }),
      ]),
    );

    expect(id).toBeNull();
  });

  it("returns null when no track is folder backed", () => {
    const id = commonFolderSourceId(
      playlist([track({ id: "1", sourceKind: "opfs" })]),
    );

    expect(id).toBeNull();
  });

  it("returns null for an empty playlist", () => {
    expect(commonFolderSourceId(playlist([]))).toBeNull();
  });
});

function fakeFileHandle(): FsFileHandle & {
  createWritable: () => Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
} {
  return {
    kind: "file",
    name: "Mix.m3u",
    getFile: async () => new File([""], "Mix.m3u"),
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
    }),
  };
}

describe("writeTextFileToDirectory", () => {
  let getFileHandle: jest.Mock<
    (name: string, options: { create: boolean }) => Promise<FsFileHandle>
  >;

  beforeEach(() => {
    getFileHandle = jest.fn(async () => fakeFileHandle());
  });

  it("creates the playlist file at the directory root", async () => {
    const handle = {
      kind: "directory",
      name: "Music",
      getFileHandle,
    } as unknown as FsDirectoryHandle;

    await writeTextFileToDirectory(handle, "Mix.m3u", "#EXTM3U\n");

    expect(getFileHandle).toHaveBeenCalledWith("Mix.m3u", { create: true });
  });

  it("rejects when the handle cannot create files", async () => {
    const handle = {
      kind: "directory",
      name: "Music",
    } as unknown as FsDirectoryHandle;

    await expect(
      writeTextFileToDirectory(handle, "Mix.m3u", "#EXTM3U\n"),
    ).rejects.toThrow(/does not support file creation/);
  });
});

describe("ensureWritePermission", () => {
  it("returns true when readwrite access is already granted", async () => {
    const handle = {
      kind: "directory",
      name: "Music",
      queryPermission: async () => "granted",
      requestPermission: async () => "denied",
    } as unknown as FsDirectoryHandle;

    await expect(ensureWritePermission(handle)).resolves.toBe(true);
  });

  it("requests readwrite access when only read was granted", async () => {
    const requestPermission = jest.fn(async () => "granted");
    const handle = {
      kind: "directory",
      name: "Music",
      queryPermission: async () => "prompt",
      requestPermission,
    } as unknown as FsDirectoryHandle;

    await expect(ensureWritePermission(handle)).resolves.toBe(true);
    expect(requestPermission).toHaveBeenCalledWith({ mode: "readwrite" });
  });

  it("returns false when the user denies write access", async () => {
    const handle = {
      kind: "directory",
      name: "Music",
      queryPermission: async () => "denied",
      requestPermission: async () => "denied",
    } as unknown as FsDirectoryHandle;

    await expect(ensureWritePermission(handle)).resolves.toBe(false);
  });
});

describe("pickWritableDirectory", () => {
  const win = globalThis.window as unknown as Record<string, unknown>;

  function stubPicker(value: unknown): void {
    win.showDirectoryPicker = value;
  }

  afterEach(() => {
    delete win.showDirectoryPicker;
  });

  it("opens the picker in readwrite mode seeded with the source folder", async () => {
    const startIn = { kind: "directory", name: "Music" } as FsDirectoryHandle;
    const showDirectoryPicker = jest.fn(async () => startIn);
    stubPicker(showDirectoryPicker);

    await expect(pickWritableDirectory(startIn)).resolves.toBe(startIn);
    expect(showDirectoryPicker).toHaveBeenCalledWith({
      mode: "readwrite",
      startIn,
    });
  });

  it("returns null when the user dismisses the picker", async () => {
    stubPicker(async () => {
      throw new Error("AbortError");
    });

    await expect(pickWritableDirectory()).resolves.toBeNull();
  });

  it("returns null when the picker is unsupported", async () => {
    delete win.showDirectoryPicker;

    await expect(pickWritableDirectory()).resolves.toBeNull();
  });
});
