import { describe, it, expect, jest, beforeEach } from "@jest/globals";

type FileEntry = { name: string; lastModified: number; contents: string };

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function withText(file: File, contents: string): File {
  Object.defineProperty(file, "text", { value: async () => contents });
  return file;
}

function fakeOpfs(initial: Record<string, string> = {}) {
  let clock = 0;
  const stamp = () => (clock += 10);

  const files = new Map<string, FileEntry>(
    Object.entries(initial).map(([path, contents], index) => [
      path,
      {
        name: path.split("/").pop() as string,
        lastModified: 1000 + index * 10,
        contents,
      },
    ]),
  );

  const createdDirs = new Set<string>();

  const dirs = () => {
    const seen = new Set<string>(createdDirs);
    for (const path of files.keys()) {
      const parts = path.split("/");
      parts.pop();
      for (let i = 1; i <= parts.length; i++)
        seen.add(parts.slice(0, i).join("/"));
    }
    return seen;
  };

  const notFound = () => {
    const error = new DOMException("not found", "NotFoundError");
    return error;
  };

  const dirHandle = (prefix: string): FileSystemDirectoryHandle =>
    ({
      kind: "directory",
      name: prefix.split("/").pop() ?? "",
      async getDirectoryHandle(name: string, options?: { create?: boolean }) {
        const child = prefix ? `${prefix}/${name}` : name;
        if (!dirs().has(child)) {
          if (!options?.create) throw notFound();
          createdDirs.add(child);
        }
        return dirHandle(child);
      },
      async getFileHandle(name: string, options?: { create?: boolean }) {
        const path = prefix ? `${prefix}/${name}` : name;
        if (!files.has(path)) {
          if (!options?.create) throw notFound();
          files.set(path, { name, lastModified: stamp(), contents: "" });
        }
        const entry = files.get(path) as FileEntry;
        return {
          kind: "file",
          name,
          async getFile() {
            return withText(
              new File([entry.contents], name, {
                lastModified: entry.lastModified,
              }),
              entry.contents,
            );
          },
          async createWritable() {
            let buffer = "";
            return {
              async write(data: Blob) {
                buffer = await readBlob(data);
                entry.lastModified = stamp();
              },
              async close() {
                entry.contents = buffer;
              },
            };
          },
        } as unknown as FileSystemFileHandle;
      },
      async removeEntry(name: string) {
        const path = prefix ? `${prefix}/${name}` : name;
        const before = files.size;
        for (const key of [...files.keys()]) {
          if (key === path || key.startsWith(`${path}/`)) files.delete(key);
        }
        if (files.size === before) throw notFound();
      },
      async *values() {
        for (const name of new Set(
          [...files.keys()]
            .filter((path) => {
              const parent = path.split("/").slice(0, -1).join("/");
              return parent === prefix;
            })
            .map((path) => path.split("/").pop() as string),
        )) {
          const path = prefix ? `${prefix}/${name}` : name;
          const entry = files.get(path) as FileEntry;
          yield {
            kind: "file",
            name,
            async getFile() {
              return withText(
                new File([entry.contents], name, {
                  lastModified: entry.lastModified,
                }),
                entry.contents,
              );
            },
          } as unknown as FileSystemFileHandle;
        }
      },
    }) as unknown as FileSystemDirectoryHandle;

  Object.defineProperty(globalThis.navigator, "storage", {
    value: { getDirectory: async () => dirHandle("") },
    configurable: true,
  });

  return files;
}

describe("opfs generic file helpers", () => {
  let files: Map<string, FileEntry>;

  const load = async () => {
    jest.resetModules();
    files = fakeOpfs();
    return import("../src/platform/storage/opfs");
  };

  beforeEach(() => {
    jest.resetModules();
  });

  it("writes and reads a file in a nested directory", async () => {
    const { saveFile, readFile } = await load();
    await saveFile("exports/road.m3u", new Blob(["#EXTM3U\n"]));

    const blob = await readFile("exports/road.m3u");
    expect(await blob?.text()).toBe("#EXTM3U\n");
  });

  it("returns null when reading a file that is not there", async () => {
    const { readFile } = await load();
    expect(await readFile("exports/missing.m3u")).toBeNull();
  });

  it("returns an empty list for a directory that does not exist", async () => {
    const { listFiles } = await load();
    expect(await listFiles("exports")).toEqual([]);
  });

  it("lists files with their size and modification time", async () => {
    const { saveFile, listFiles } = await load();
    await saveFile("exports/one.m3u", new Blob(["#EXTM3U\n"]));
    await saveFile("exports/two.m3u", new Blob(["#EXTM3U\na.mp3\n"]));

    const entries = await listFiles("exports");
    expect(entries.map((entry) => entry.name).sort()).toEqual([
      "one.m3u",
      "two.m3u",
    ]);
    const two = entries.find((entry) => entry.name === "two.m3u");
    expect(two?.size).toBe("#EXTM3U\na.mp3\n".length);
    expect(two?.lastModified).toBeGreaterThan(0);
  });

  it("orders listings newest first", async () => {
    const { saveFile, listFiles } = await load();
    await saveFile("exports/old.m3u", new Blob(["a"]));
    files.get("exports/old.m3u")!.lastModified = 1;
    await saveFile("exports/new.m3u", new Blob(["b"]));
    files.get("exports/new.m3u")!.lastModified = 99;

    const entries = await listFiles("exports");
    expect(entries.map((entry) => entry.name)).toEqual(["new.m3u", "old.m3u"]);
  });

  it("replaces the contents when writing the same path twice", async () => {
    const { saveFile, readFile } = await load();
    await saveFile("exports/a.m3u", new Blob(["first"]));
    await saveFile("exports/a.m3u", new Blob(["second"]));

    expect(await (await readFile("exports/a.m3u"))?.text()).toBe("second");
  });

  it("deletes a file and reports whether it existed", async () => {
    const { saveFile, deleteFile } = await load();
    await saveFile("exports/a.m3u", new Blob(["a"]));

    expect(await deleteFile("exports/a.m3u")).toBe(true);
    expect(await deleteFile("exports/a.m3u")).toBe(false);
  });

  it("keeps a traversal attempt inside the intended directory", async () => {
    const { saveFile, readFile, listFiles } = await load();
    await saveFile("exports/../escape.m3u", new Blob(["x"]));

    expect(await readFile("exports/_/escape.m3u")).not.toBeNull();
    expect(await readFile("escape.m3u")).toBeNull();
  });

  it("rejects a path that names no file", async () => {
    const { saveFile } = await load();
    await expect(saveFile("exports/", new Blob(["x"]))).rejects.toThrow(
      /Not a file path/,
    );
  });
});

describe("exportStorage", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const load = async () => {
    fakeOpfs();
    return import("../src/platform/storage/exportStorage");
  };

  it("keeps a saved export under the exports directory", async () => {
    const { exportStorage } = await load();
    const saved = await exportStorage.save("Road Trip.m3u", "#EXTM3U\n");

    expect(saved.name).toBe("Road Trip.m3u");
    expect(saved.size).toBeGreaterThan(0);
    expect(await exportStorage.read("Road Trip.m3u")).toBe("#EXTM3U\n");
  });

  it("lists saved exports newest first", async () => {
    const { exportStorage } = await load();
    await exportStorage.save("first.m3u", "#EXTM3U\na.mp3\n");
    await exportStorage.save("second.m3u", "#EXTM3U\nb.mp3\n");

    const list = await exportStorage.list();
    expect(list.map((entry) => entry.name)).toEqual([
      "second.m3u",
      "first.m3u",
    ]);
  });

  it("overwrites an export of the same name instead of duplicating it", async () => {
    const { exportStorage } = await load();
    await exportStorage.save("a.m3u", "old");
    await exportStorage.save("a.m3u", "new");

    expect(await exportStorage.read("a.m3u")).toBe("new");
    expect(await exportStorage.list()).toHaveLength(1);
  });

  it("removes a single export and leaves the others", async () => {
    const { exportStorage } = await load();
    await exportStorage.save("keep.m3u", "a");
    await exportStorage.save("drop.m3u", "b");

    expect(await exportStorage.remove("drop.m3u")).toBe(true);
    expect((await exportStorage.list()).map((entry) => entry.name)).toEqual([
      "keep.m3u",
    ]);
  });

  it("clears every saved export", async () => {
    const { exportStorage } = await load();
    await exportStorage.save("a.m3u", "a");
    await exportStorage.save("b.m3u", "b");

    await exportStorage.clear();
    expect(await exportStorage.list()).toEqual([]);
  });

  it("starts empty when nothing has been exported", async () => {
    const { exportStorage } = await load();
    expect(await exportStorage.list()).toEqual([]);
  });
});
