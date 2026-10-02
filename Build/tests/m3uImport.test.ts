import type { Track } from "../src/core/engine/types";
import { parseM3u } from "../src/platform/library/m3u";
import {
  matchM3uEntries,
  planM3uImport,
} from "../src/platform/storage/m3uImport";
import { exportPlaylistToM3u } from "../src/platform/storage/m3uExport";
import type { FsDirectoryHandle, FsFileHandle } from "../src/platform/storage/directoryHandle";
import { describe, expect, it } from "@jest/globals";

function fakeDirectory(
  files: Record<string, string>,
  walkCalls: { count: number },
): FsDirectoryHandle {
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
      getFile: async () =>
        new File([node.files.get(fileName) ?? ""], fileName),
    });

    return {
      kind: "directory",
      name,
      values: async function* () {
        if (node === root) walkCalls.count++;
        for (const fileName of node.files.keys()) {
          yield fileHandle(fileName);
        }
        for (const [dirName, child] of node.dirs) {
          yield handleFor(child, dirName);
        }
      },
      async getFileHandle(fileName: string) {
        if (!node.files.has(fileName)) {
          throw new DOMException(`${fileName} not found`, "NotFoundError");
        }
        return fileHandle(fileName);
      },
      async getDirectoryHandle(dirName: string) {
        const child = node.dirs.get(dirName);
        if (!child) {
          throw new DOMException(`${dirName} not found`, "NotFoundError");
        }
        return handleFor(child, dirName);
      },
      queryPermission: async () => "granted" as PermissionState,
      requestPermission: async () => "granted" as PermissionState,
    } as unknown as FsDirectoryHandle;
  };

  return handleFor(root, "root");
}

const flat = {
  "a.mp3": "a",
  "b.mp3": "b",
};

describe("matchM3uEntries", () => {
  it("resolves every entry by path without walking the tree", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory(flat, walkCalls);
    const entries = parseM3u("#EXTM3U\n#EXTINF:1,A\na.mp3\n");

    const result = await matchM3uEntries(entries, handle, "auto");

    expect(result.resolutions[0]).toMatchObject({ kind: "path", path: "a.mp3" });
    expect(result.scanned).toBe(false);
    expect(walkCalls.count).toBe(0);
  });

  it("falls back to a recursive name match in auto mode", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory({ "Deep/Nested/a.mp3": "a" }, walkCalls);
    const entries = parseM3u("#EXTM3U\n#EXTINF:1,A\na.mp3\n");

    const result = await matchM3uEntries(entries, handle, "auto");

    expect(result.resolutions[0]).toMatchObject({
      kind: "name",
      path: "Deep/Nested/a.mp3",
    });
    expect(result.fallbacks).toBe(1);
    expect(result.scanned).toBe(true);
  });

  it("does not fall back in path mode", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory({ "Deep/Nested/a.mp3": "a" }, walkCalls);
    const entries = parseM3u("#EXTM3U\n#EXTINF:1,A\na.mp3\n");

    const result = await matchM3uEntries(entries, handle, "path");

    expect(result.resolutions[0]).toEqual({ kind: "missing" });
    expect(walkCalls.count).toBe(0);
  });

  it("matches by name directly in filename mode without trying the path first", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory({ "Deep/a.mp3": "a" }, walkCalls);
    const entries = parseM3u("#EXTM3U\n#EXTINF:1,A\nDeep/a.mp3\n");

    const result = await matchM3uEntries(entries, handle, "filename");

    expect(result.resolutions[0]).toMatchObject({ kind: "name" });
    expect(result.fallbacks).toBe(0);
  });

  it("reports a duplicated name as ambiguous", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory(
      { "One/a.mp3": "1", "Two/a.mp3": "2" },
      walkCalls,
    );
    const entries = parseM3u("#EXTM3U\n#EXTINF:1,A\na.mp3\n");

    const result = await matchM3uEntries(entries, handle, "filename");

    expect(result.resolutions[0]).toEqual({
      kind: "ambiguous",
      candidates: ["One/a.mp3", "Two/a.mp3"],
    });
  });

  it("scans at most once for a playlist that needs many fallbacks", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory({ "x/a.mp3": "a", "y/b.mp3": "b" }, walkCalls);
    const entries = parseM3u("#EXTM3U\n#EXTINF:1,A\na.mp3\n#EXTINF:1,B\nb.mp3\n");

    const result = await matchM3uEntries(entries, handle, "auto");

    expect(result.fallbacks).toBe(2);
    expect(walkCalls.count).toBe(1);
  });

  it("passes a remote entry through untouched", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory(flat, walkCalls);
    const entries = parseM3u("#EXTM3U\n#EXTINF:-1,Live\nhttp://s/live\n");

    const result = await matchM3uEntries(entries, handle, "auto");

    expect(result.resolutions[0]).toEqual({
      kind: "remote",
      url: "http://s/live",
    });
    expect(walkCalls.count).toBe(0);
  });
});

describe("planM3uImport", () => {
  it("keeps only entries that are not already in the library", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory(flat, walkCalls);
    const entries = parseM3u(
      "#EXTM3U\n#EXTINF:1,A\na.mp3\n#EXTINF:1,B\nb.mp3\n",
    );
    const result = await matchM3uEntries(entries, handle, "auto");
    const existing: Track[] = [
      {
        id: "existing",
        title: "A",
        url: "",
        hasStoredAudio: true,
        sourceKind: "folderHandle",
        sourceId: "dir",
        path: "a.mp3",
      } as Track,
    ];

    const plan = planM3uImport(entries, result, () => existing);

    expect(plan.files.map((match) => match.path)).toEqual(["b.mp3"]);
    expect(plan.slots).toEqual([
      { kind: "existing", track: expect.objectContaining({ id: "existing" }) },
      { kind: "file", match: expect.objectContaining({ path: "b.mp3" }) },
    ]);
  });

  it("deduplicates repeated locations within one playlist", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory(flat, walkCalls);
    const entries = parseM3u(
      "#EXTM3U\n#EXTINF:1,A\na.mp3\n#EXTINF:1,A again\na.mp3\n",
    );
    const result = await matchM3uEntries(entries, handle, "auto");

    const plan = planM3uImport(entries, result, () => []);

    expect(plan.files).toHaveLength(1);
  });

  it("separates missing and ambiguous entries with their candidates", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory({ "One/a.mp3": "1" }, walkCalls);
    const entries = parseM3u(
      "#EXTM3U\n#EXTINF:1,A\na.mp3\n#EXTINF:1,Gone\ngone.mp3\n",
    );
    const result = await matchM3uEntries(entries, handle, "auto");

    const plan = planM3uImport(entries, result, () => []);

    expect(plan.unresolved).toHaveLength(1);
    expect(plan.unresolved[0]).toMatchObject({
      reason: "missing",
      entry: { path: "gone.mp3" },
    });
  });

  it("treats a fallback match as importable and reports the count", async () => {
    const walkCalls = { count: 0 };
    const handle = fakeDirectory({ "Deep/a.mp3": "a" }, walkCalls);
    const entries = parseM3u("#EXTM3U\n#EXTINF:1,A\na.mp3\n");
    const result = await matchM3uEntries(entries, handle, "auto");

    const plan = planM3uImport(entries, result, () => []);

    expect(plan.files[0]).toMatchObject({
      matchedBy: "name",
      path: "Deep/a.mp3",
    });
    expect(plan.fallbacks).toBe(1);
  });
});

describe("exportPlaylistToM3u", () => {
  const song = (overrides: Partial<Track>): Track =>
    ({
      id: "id",
      title: "Title",
      url: "",
      hasStoredAudio: true,
      ...overrides,
    }) as Track;

  it("writes folder-linked tracks as relative paths", () => {
    const result = exportPlaylistToM3u({
      id: "p",
      name: "Set",
      songs: [
        song({
          id: "1",
          title: "One",
          sourceKind: "folderHandle",
          sourceId: "dir",
          path: "Album/01.mp3",
        }),
      ],
    });

    expect(result.text).toContain("Album/01.mp3");
    expect(result.skipped).toHaveLength(0);
  });

  it("writes a remote url as-is", () => {
    const result = exportPlaylistToM3u({
      id: "p",
      name: "Set",
      songs: [song({ id: "1", url: "https://s/live" })],
    });

    expect(result.text).toContain("https://s/live");
  });

  it("skips opfs tracks whose only url is a session blob", () => {
    const result = exportPlaylistToM3u({
      id: "p",
      name: "Set",
      songs: [song({ id: "1", url: "blob:http://localhost/abc" })],
    });

    expect(result.text).not.toContain("blob:");
    expect(result.skipped).toEqual([
      { id: "1", name: "Title", reason: "noLocation" },
    ]);
  });

  it("keeps track order and includes the artist in the title", () => {
    const result = exportPlaylistToM3u({
      id: "p",
      name: "Set",
      songs: [
        song({
          id: "1",
          title: "B",
          artist: "Artist",
          sourceKind: "folderHandle",
          path: "b.mp3",
        }),
        song({
          id: "2",
          title: "A",
          sourceKind: "folderHandle",
          path: "a.mp3",
        }),
      ],
    });

    expect(result.text.indexOf("b.mp3")).toBeLessThan(
      result.text.indexOf("a.mp3"),
    );
    expect(result.text).toContain("Artist - B");
  });

  it("round-trips an exported playlist back through the parser", () => {
    const result = exportPlaylistToM3u({
      id: "p",
      name: "Set",
      songs: [
        song({
          id: "1",
          title: "One",
          duration: 210,
          sourceKind: "folderHandle",
          path: "Album/01.mp3",
        }),
      ],
    });

    const reparsed = parseM3u(result.text);
    expect(reparsed[0]).toMatchObject({
      path: "Album/01.mp3",
      title: "One",
      duration: 210,
    });
  });
});
