import { createLogger } from "../../helpers/logger";

const logger = createLogger("directoryHandle");

export const SUPPORTED_AUDIO_RE = /\.(mp3|flac|ogg|wav|m4a|aac|wma|flo)$/i;
export const MAX_WALK_DEPTH = 15;

export interface FsWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FsFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable?(): Promise<FsWritable>;
}

export interface FsDirectoryHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<FsEntryHandle>;
  getDirectoryHandle?(
    name: string,
    options?: { create?: boolean },
  ): Promise<FsDirectoryHandle>;
  getFileHandle?(
    name: string,
    options?: { create?: boolean },
  ): Promise<FsFileHandle>;
  queryPermission?(descriptor: { mode: string }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: string }): Promise<PermissionState>;
}

export type FsEntryHandle = FsDirectoryHandle | FsFileHandle;

export interface DirectoryFile {
  file: File;
  relativePath: string;
}

export interface DirectoryIndex {
  byName: Map<string, DirectoryFile[]>;
  fileCount: number;
}

export function isAudioPath(path: string): boolean {
  return SUPPORTED_AUDIO_RE.test(path);
}

export function baseName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

export function isDirectoryPickerSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

export async function pickDirectory(): Promise<FsDirectoryHandle | null> {
  if (!isDirectoryPickerSupported()) return null;
  try {
    return await (
      window as unknown as {
        showDirectoryPicker: (options?: unknown) => Promise<FsDirectoryHandle>;
      }
    ).showDirectoryPicker({ mode: "read" });
  } catch {
    return null;
  }
}

export function isWritableDirectoryPickerSupported(): boolean {
  return isDirectoryPickerSupported();
}

export async function pickWritableDirectory(
  startIn?: FsDirectoryHandle,
): Promise<FsDirectoryHandle | null> {
  if (!isWritableDirectoryPickerSupported()) return null;
  try {
    return await (
      window as unknown as {
        showDirectoryPicker: (options?: unknown) => Promise<FsDirectoryHandle>;
      }
    ).showDirectoryPicker({ mode: "readwrite", startIn });
  } catch {
    return null;
  }
}

export async function ensureReadPermission(
  handle: FsDirectoryHandle,
): Promise<boolean> {
  return ensureDirectoryPermission(handle, "read");
}

export async function ensureWritePermission(
  handle: FsDirectoryHandle,
): Promise<boolean> {
  return ensureDirectoryPermission(handle, "readwrite");
}

async function ensureDirectoryPermission(
  handle: FsDirectoryHandle,
  mode: "read" | "readwrite",
): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return false;
  try {
    if ((await handle.queryPermission({ mode })) === "granted") return true;
    return (await handle.requestPermission({ mode })) === "granted";
  } catch (error) {
    logger.warn(`Failed to grant ${mode} permission for folder`, {
      name: handle.name,
      error: String(error),
    });
    return false;
  }
}

export async function writeTextFileToDirectory(
  handle: FsDirectoryHandle,
  fileName: string,
  text: string,
): Promise<void> {
  if (!handle.getFileHandle) {
    throw new Error("Directory handle does not support file creation");
  }
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  if (!fileHandle.createWritable) {
    throw new Error("File handle does not support writing");
  }
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function* walkFiles(
  handle: FsDirectoryHandle,
  prefix = "",
  depth = 0,
): AsyncGenerator<{ handle: FsFileHandle; relativePath: string }> {
  if (depth > MAX_WALK_DEPTH) return;

  for await (const entry of handle.values()) {
    if (entry.name.startsWith(".")) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.kind === "file") {
      yield { handle: entry, relativePath };
    } else if (entry.kind === "directory") {
      yield* walkFiles(entry, relativePath, depth + 1);
    }
  }
}

export async function collectAudioFiles(
  handle: FsDirectoryHandle,
): Promise<DirectoryFile[]> {
  const audioFiles: DirectoryFile[] = [];
  for await (const { handle: fileHandle, relativePath } of walkFiles(handle)) {
    if (!isAudioPath(relativePath)) continue;
    try {
      audioFiles.push({
        file: await fileHandle.getFile(),
        relativePath,
      });
    } catch (error) {
      logger.warn("Failed to read audio file from folder", {
        name: fileHandle.name,
        error: String(error),
      });
    }
  }
  return audioFiles;
}

export async function resolveFileAtPath(
  handle: unknown,
  relativePath: string,
): Promise<File | null> {
  try {
    const parts = relativePath.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return null;

    let dir = handle as FsDirectoryHandle;
    for (const segment of parts) {
      if (!dir.getDirectoryHandle) return null;
      dir = await dir.getDirectoryHandle(segment);
    }
    if (!dir.getFileHandle) return null;
    const fileHandle = await dir.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch (error) {
    logger.warn("Failed to resolve folder-handle path", {
      path: relativePath,
      error: String(error),
    });
    return null;
  }
}

export async function buildDirectoryIndex(
  handle: FsDirectoryHandle,
): Promise<DirectoryIndex> {
  const byName = new Map<string, DirectoryFile[]>();
  let fileCount = 0;

  for await (const { handle: fileHandle, relativePath } of walkFiles(handle)) {
    fileCount++;
    if (!isAudioPath(relativePath)) continue;
    try {
      const file = await fileHandle.getFile();
      const key = baseName(relativePath).toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        existing.push({ file, relativePath });
      } else {
        byName.set(key, [{ file, relativePath }]);
      }
    } catch (error) {
      logger.warn("Failed to index audio file for name matching", {
        name: fileHandle.name,
        error: String(error),
      });
    }
  }

  return { byName, fileCount };
}
