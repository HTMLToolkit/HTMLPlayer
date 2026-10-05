import { createLogger } from "../../helpers/logger";

const logger = createLogger("opfs");

const SONGS_DIR = "songs";

export interface OpfsEntry {
  name: string;
  size: number;
  lastModified: number;
}

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<
    FileSystemFileHandle | FileSystemDirectoryHandle
  >;
};

function isDirectory(
  handle: FileSystemFileHandle | FileSystemDirectoryHandle,
): handle is FileSystemDirectoryHandle {
  return handle.kind === "directory";
}

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null;
const dirCache = new Map<string, Promise<FileSystemDirectoryHandle>>();

export type OpfsUnavailableReason =
  "no-navigator" | "insecure-context" | "unsupported";

export type OpfsAvailability =
  | { available: true }
  | { available: false; reason: OpfsUnavailableReason; message: string };

export function opfsAvailability(): OpfsAvailability {
  if (typeof navigator === "undefined") {
    return {
      available: false,
      reason: "no-navigator",
      message: "OPFS is unavailable because there is no navigator.",
    };
  }

  if (typeof navigator.storage?.getDirectory !== "function") {
    if (typeof isSecureContext === "boolean" && !isSecureContext) {
      return {
        available: false,
        reason: "insecure-context",
        message: `OPFS requires a secure context, and ${location.origin} is not one. Open the app over HTTPS, or via http://localhost, instead of a plain-HTTP LAN address.`,
      };
    }
    return {
      available: false,
      reason: "unsupported",
      message:
        "This browser does not implement navigator.storage.getDirectory (OPFS).",
    };
  }

  return { available: true };
}

function navigatorStorage(): StorageManager | null {
  if (typeof navigator === "undefined") return null;
  const storage = navigator.storage;
  if (typeof storage?.getDirectory !== "function") return null;
  return storage;
}

function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (rootPromise) return rootPromise;

  const availability = opfsAvailability();
  if (!availability.available) {
    logger.error("Cannot use OPFS", {
      reason: availability.reason,
      origin: location.origin,
    });
    rootPromise = Promise.reject(new Error(availability.message));
    return rootPromise;
  }

  rootPromise = navigatorStorage()!.getDirectory();
  return rootPromise;
}

function getDir(
  path: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  const key = `${create ? "c" : "r"}:${path}`;
  const cached = dirCache.get(key);
  if (cached) return cached;

  const segments = path.split("/").filter(Boolean).map(sanitizeSegment);
  const promise = getRoot().then(async (root) => {
    let dir = root;
    for (const segment of segments) {
      dir = await dir.getDirectoryHandle(segment, { create });
    }
    return dir;
  });

  promise.catch(() => dirCache.delete(key));
  dirCache.set(key, promise);
  return promise;
}

function getSongsDir(): Promise<FileSystemDirectoryHandle> {
  return getDir(SONGS_DIR, true);
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

function sanitizeSegment(name: string): string {
  if (name === "." || name === "..") return "_";
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function splitPath(path: string): { dir: string; file: string } {
  if (path.endsWith("/")) {
    throw new Error(`Not a file path: ${path}`);
  }
  const segments = path.split("/").filter(Boolean);
  const file = segments.pop();
  if (file === undefined) {
    throw new Error(`Not a file path: ${path}`);
  }
  return { dir: segments.join("/"), file: sanitizeSegment(file) };
}

export async function saveAudio(songId: string, blob: Blob): Promise<void> {
  const dir = await getSongsDir();
  const handle = await dir.getFileHandle(sanitizeSegment(songId), {
    create: true,
  });
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

export async function loadAudio(songId: string): Promise<Blob | null> {
  try {
    const dir = await getSongsDir();
    const handle = await dir.getFileHandle(sanitizeSegment(songId));
    return await handle.getFile();
  } catch (error) {
    if (isNotFoundError(error)) return null;
    logger.warn("Failed to load audio from OPFS", {
      songId,
      error: String(error),
    });
    return null;
  }
}

export async function deleteAudio(songId: string): Promise<void> {
  try {
    const dir = await getSongsDir();
    await dir.removeEntry(sanitizeSegment(songId));
  } catch (error) {
    if (isNotFoundError(error)) return;
    logger.warn("Failed to delete audio from OPFS", {
      songId,
      error: String(error),
    });
  }
}

export async function removeAllAudio(): Promise<void> {
  try {
    const root = await getRoot();
    await root.removeEntry(SONGS_DIR, { recursive: true });
    dirCache.delete(`c:${SONGS_DIR}`);
  } catch (error) {
    if (isNotFoundError(error)) return;
    logger.warn("Failed to clear OPFS audio", { error: String(error) });
  }
}

export async function saveFile(path: string, blob: Blob): Promise<void> {
  const { dir, file } = splitPath(path);
  const directory = await getDir(dir, true);
  const handle = await directory.getFileHandle(file, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

export async function readFile(path: string): Promise<Blob | null> {
  const { dir, file } = splitPath(path);
  try {
    const handle = await (await getDir(dir, false)).getFileHandle(file);
    return await handle.getFile();
  } catch (error) {
    if (isNotFoundError(error)) return null;
    logger.warn("Failed to read file from OPFS", {
      path,
      error: String(error),
    });
    return null;
  }
}

export async function listFiles(path: string): Promise<OpfsEntry[]> {
  const entries: OpfsEntry[] = [];
  try {
    const dir = (await getDir(path, false)) as IterableDirectoryHandle;
    for await (const handle of dir.values()) {
      if (isDirectory(handle)) continue;
      const file = await handle.getFile();
      entries.push({
        name: handle.name,
        size: file.size,
        lastModified: file.lastModified,
      });
    }
  } catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }

  return entries.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
}

export async function deleteFile(path: string): Promise<boolean> {
  const { dir, file } = splitPath(path);
  try {
    await (await getDir(dir, false)).removeEntry(file);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

export async function ensureStoragePersistent(): Promise<boolean> {
  const storage = navigatorStorage();
  if (!storage?.persist) return true;
  try {
    return await storage.persist();
  } catch (error) {
    logger.warn("Failed to request persistent storage permission", {
      error: String(error),
    });
    return false;
  }
}
