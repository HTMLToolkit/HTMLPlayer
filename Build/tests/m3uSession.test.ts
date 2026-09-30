import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Playlist, Track } from "../src/core/engine/types";
import {
  remapM3uEntry,
  runM3uImport,
  type M3uImportDeps,
  type M3uImportOutcome,
} from "../src/platform/storage/m3uSession";
import type {
  FsDirectoryHandle,
  FsFileHandle,
} from "../src/platform/storage/directoryHandle";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock("../src/platform/storage/directoryStore", () => ({
  directoryStore: {
    get: jest.fn(),
    save: jest.fn(),
    loadAll: jest.fn(async () => []),
  },
  upsertDirectory: jest.fn(async (name: string, handle: unknown) => ({
    id: "dir-1",
    name,
    handle,
    entries: {},
  })),
  reindexDirectory: jest.fn(async () => undefined),
}));

jest.mock("../src/helpers/addSong", () => ({
  storeImportedSong: jest.fn(async (song: Track) => song),
  storeRemoteSong: jest.fn(async (song: Track) => song),
}));

jest.mock("../src/helpers/importAudioFiles", () => ({
  importAudioFiles: jest.fn(),
}));

const { directoryStore } = jest.requireMock(
  "../src/platform/storage/directoryStore",
) as { directoryStore: { get: jest.Mock } };
const { importAudioFiles } = jest.requireMock(
  "../src/helpers/importAudioFiles",
) as { importAudioFiles: jest.Mock };

function fakeDirectory(files: Record<string, string>): FsDirectoryHandle {
  interface Node {
    files: Map<string, string>;
    dirs: Map<string, Node>;
  }
  const root: Node = { files: new Map(), dirs: new Map() };

  for (const [relativePath, contents] of Object.entries(files)) {
    const segments = relativePath.split("/");
    const name = segments.pop() as string;
    let node = root;
    for (const segment of segments) {
      let child = node.dirs.get(segment);
      if (!child) {
        child = { files: new Map(), dirs: new Map() };
        node.dirs.set(segment, child);
      }
      node = child;
    }
    node.files.set(name, contents);
  }

  const handleFor = (node: Node, name: string): FsDirectoryHandle => {
    const fileHandle = (fileName: string): FsFileHandle => ({
      kind: "file",
      name: fileName,
      getFile: async () => new File([node.files.get(fileName) ?? ""], fileName),
    });
    return {
      kind: "directory",
      name,
      values: async function* () {
        for (const fileName of node.files.keys()) yield fileHandle(fileName);
        for (const [dirName, child] of node.dirs) {
          yield handleFor(child, dirName);
        }
      },
      async getFileHandle(fileName: string) {
        if (!node.files.has(fileName)) throw new Error("NotFoundError");
        return fileHandle(fileName);
      },
      async getDirectoryHandle(dirName: string) {
        const child = node.dirs.get(dirName);
        if (!child) throw new Error("NotFoundError");
        return handleFor(child, dirName);
      },
      queryPermission: async () => "granted" as PermissionState,
      requestPermission: async () => "granted" as PermissionState,
    } as unknown as FsDirectoryHandle;
  };

  return handleFor(root, "Music");
}

const m3uFile = (text: string) => {
  const file = new File([text], "Road Trip.m3u", { type: "audio/x-mpegurl" });
  Object.defineProperty(file, "text", { value: async () => text });
  return file;
};

const translate = (key: string) => key;

const mockImporter = async (
  items: Array<{ file: File; path: string }>,
  addSong: (song: Track, file: File, context: object) => Promise<void>,
) => {
  const songs: Track[] = [];
  for (const item of items) {
    const song = {
      id: `song-${item.path}`,
      title: item.path,
      artist: "",
      album: "",
      duration: 0,
      url: "",
      hasStoredAudio: true,
      sourceKind: "folderHandle",
      sourceId: "dir-1",
      path: item.path,
    } as Track;
    await addSong(song, item.file, {});
    songs.push(song);
  }
  return {
    successCount: songs.length,
    duplicateCount: 0,
    errorCount: 0,
    songs,
  };
};

interface Harness {
  deps: M3uImportDeps;
  tracks: Track[];
  playlists: Playlist[];
  addedTo: Array<{ playlistId: string; track: Track }>;
}

function harness(
  handle: FsDirectoryHandle | null,
  initialTracks: Track[] = [],
): Harness {
  const tracks = [...initialTracks];
  const playlists: Playlist[] = [];
  const addedTo: Array<{ playlistId: string; track: Track }> = [];

  return {
    tracks,
    playlists,
    addedTo,
    deps: {
      getTracks: () => tracks,
      addTrack: (track) => tracks.push(track),
      addPlaylist: (playlist) => playlists.push(playlist),
      addToPlaylist: (playlistId, track) => addedTo.push({ playlistId, track }),
      pickBaseDirectory: async () => handle,
      t: translate,
    },
  };
}

describe("runM3uImport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    importAudioFiles.mockImplementation(mockImporter);
  });

  it("creates a playlist with one track per matched entry, in order", async () => {
    const handle = fakeDirectory({ "a.mp3": "a", "b.mp3": "b" });
    const { deps, playlists, tracks } = harness(handle);

    const result = await runM3uImport(
      m3uFile("#EXTM3U\n#EXTINF:1,A\na.mp3\n#EXTINF:1,B\nb.mp3\n"),
      "auto",
      deps,
    );

    expect(result.status).toBe("imported");
    expect(playlists).toHaveLength(1);
    expect(playlists[0]?.name).toBe("Road Trip");
    expect(playlists[0]?.songs.map((song) => song.path)).toEqual([
      "a.mp3",
      "b.mp3",
    ]);
    expect(tracks).toHaveLength(2);
  });

  it("keeps entries that are already in the library and reports them as reused", async () => {
    const handle = fakeDirectory({ "a.mp3": "a" });
    const existing = {
      id: "existing",
      title: "A",
      artist: "",
      album: "",
      duration: 1,
      url: "",
      hasStoredAudio: true,
      sourceKind: "folderHandle",
      sourceId: "dir-1",
      path: "a.mp3",
    } as Track;
    const { deps, playlists, tracks } = harness(handle, [existing]);

    const result = await runM3uImport(
      m3uFile("#EXTM3U\n#EXTINF:1,A\na.mp3\n"),
      "auto",
      deps,
    );

    expect(result.status).toBe("imported");
    if (result.status !== "imported") throw new Error("unreachable");
    expect(result.outcome.reused).toBe(1);
    expect(result.outcome.added).toBe(0);
    expect(tracks).toHaveLength(1);
    expect(playlists[0]?.songs[0]?.id).toBe("existing");
  });

  it("creates a track for a remote entry without asking for a folder", async () => {
    const { deps, playlists, tracks } = harness(null);

    const result = await runM3uImport(
      m3uFile(
        "#EXTM3U\n#EXTINF:-1,Artist - Live\nhttp://stream.example/live\n",
      ),
      "auto",
      deps,
    );

    expect(result.status).toBe("imported");
    if (result.status !== "imported") throw new Error("unreachable");
    expect(result.outcome.remote).toBe(1);
    expect(result.outcome.directoryId).toBeUndefined();
    expect(tracks[0]).toMatchObject({
      url: "http://stream.example/live",
      title: "Live",
      artist: "Artist",
      hasStoredAudio: false,
    });
    expect(playlists[0]?.songs).toHaveLength(1);
  });

  it("does not ask for a folder when a playlist has no local entries", async () => {
    const pickBaseDirectory = jest.fn(async () => null);
    const { deps, playlists } = harness(null);
    const result = await runM3uImport(
      m3uFile("#EXTM3U\n#EXTINF:-1,Live\nhttps://s/live\n"),
      "auto",
      { ...deps, pickBaseDirectory },
    );

    expect(result.status).toBe("imported");
    expect(pickBaseDirectory).not.toHaveBeenCalled();
    expect(playlists).toHaveLength(1);
  });

  it("reports entries it could not resolve instead of dropping them", async () => {
    const handle = fakeDirectory({ "a.mp3": "a" });
    const { deps, playlists } = harness(handle);

    const result = await runM3uImport(
      m3uFile("#EXTM3U\n#EXTINF:1,A\na.mp3\n#EXTINF:1,Gone\ngone.mp3\n"),
      "auto",
      deps,
    );

    expect(result.status).toBe("imported");
    if (result.status !== "imported") throw new Error("unreachable");
    expect(result.outcome.unresolved).toHaveLength(1);
    expect(result.outcome.unresolved[0]?.entry.path).toBe("gone.mp3");
    expect(playlists[0]?.songs).toHaveLength(1);
  });

  it("counts a file the importer recognised as a duplicate as reused, not added", async () => {
    const handle = fakeDirectory({ "a.mp3": "a" });
    const { deps, tracks } = harness(handle);
    const duplicate = {
      id: "existing",
      title: "A",
      artist: "",
      album: "",
      duration: 0,
      url: "",
      hasStoredAudio: true,
      sourceKind: "folderHandle",
      sourceId: "dir-1",
      path: "a.mp3",
    } as Track;
    importAudioFiles.mockImplementationOnce(async () => ({
      successCount: 0,
      duplicateCount: 1,
      errorCount: 0,
      songs: [duplicate],
    }));

    const result = await runM3uImport(
      m3uFile("#EXTM3U\n#EXTINF:1,A\na.mp3\n"),
      "auto",
      deps,
    );

    expect(result.status).toBe("imported");
    if (result.status !== "imported") throw new Error("unreachable");
    expect(result.outcome.added).toBe(0);
    expect(result.outcome.reused).toBe(1);
    expect(tracks).toHaveLength(0);
  });

  it("cancels when the user dismisses the folder picker", async () => {
    const { deps, playlists } = harness(null);

    const result = await runM3uImport(
      m3uFile("#EXTM3U\n#EXTINF:1,A\na.mp3\n"),
      "auto",
      deps,
    );

    expect(result.status).toBe("cancelled");
    expect(playlists).toHaveLength(0);
    expect(importAudioFiles).not.toHaveBeenCalled();
  });

  it("reports a file with no entries as empty", async () => {
    const { deps } = harness(fakeDirectory({}));

    const result = await runM3uImport(m3uFile("#EXTM3U\n"), "auto", deps);

    expect(result).toEqual({ status: "failed", reason: "empty" });
  });

  it("still saves the folder when nothing resolves so entries can be re-mapped", async () => {
    const handle = fakeDirectory({ "a.mp3": "a" });
    const { deps, playlists } = harness(handle);

    const result = await runM3uImport(
      m3uFile(
        "#EXTM3U\n#EXTINF:1,Gone\ngone.mp3\n#EXTINF:1,Also gone\nnope.mp3\n",
      ),
      "auto",
      deps,
    );

    expect(result.status).toBe("imported");
    if (result.status !== "imported") throw new Error("unreachable");
    expect(result.outcome.added).toBe(0);
    expect(result.outcome.unresolved).toHaveLength(2);
    expect(playlists[0]?.songs).toHaveLength(0);
    expect(result.outcome.directoryId).toBe("dir-1");
  });

  it("surfaces an unexpected failure as an error result", async () => {
    const { deps } = harness(fakeDirectory({ "a.mp3": "a" }));
    importAudioFiles.mockRejectedValueOnce(new Error("disk full"));

    const result = await runM3uImport(
      m3uFile("#EXTM3U\n#EXTINF:1,A\na.mp3\n"),
      "auto",
      deps,
    );

    expect(result).toEqual({
      status: "failed",
      reason: "error",
      message: "disk full",
    });
  });
});

describe("remapM3uEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    importAudioFiles.mockImplementation(mockImporter);
  });

  const outcome: M3uImportOutcome = {
    playlistId: "playlist-1",
    directoryId: "dir-1",
    name: "Road Trip",
    added: 1,
    reused: 0,
    remote: 0,
    fallbacks: 0,
    unresolved: [],
  };

  it("imports the chosen candidate and appends it to the playlist", async () => {
    const handle = fakeDirectory({ "One/a.mp3": "1" });
    directoryStore.get.mockResolvedValue({ id: "dir-1", handle, entries: {} });
    const { deps, addedTo, tracks } = harness(handle);

    const ok = await remapM3uEntry(outcome, "One/a.mp3", deps);

    expect(ok).toBe(true);
    expect(tracks[0]?.path).toBe("One/a.mp3");
    expect(addedTo).toEqual([
      {
        playlistId: "playlist-1",
        track: expect.objectContaining({ path: "One/a.mp3" }),
      },
    ]);
  });

  it("refuses when the candidate file no longer exists", async () => {
    const handle = fakeDirectory({ "a.mp3": "a" });
    directoryStore.get.mockResolvedValue({ id: "dir-1", handle, entries: {} });
    const { deps, addedTo } = harness(handle);

    const ok = await remapM3uEntry(outcome, "gone.mp3", deps);

    expect(ok).toBe(false);
    expect(addedTo).toHaveLength(0);
  });

  it("refuses when the playlist had no folder to resolve against", async () => {
    const { deps } = harness(null);

    const ok = await remapM3uEntry(
      { ...outcome, directoryId: undefined },
      "One/a.mp3",
      deps,
    );

    expect(ok).toBe(false);
  });
});
