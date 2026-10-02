import { toast } from "sonner";
import type { AudioImportOpts } from "../../helpers/importAudioFiles";
import {
  importAudioFiles,
  type ImportFileItem,
} from "../../helpers/importAudioFiles";
import {
  directoryStore,
  reindexDirectory,
  upsertDirectory,
  type PersistedDirectory,
} from "./directoryStore";
import {
  collectAudioFiles,
  ensureReadPermission,
  pickDirectory,
  type DirectoryFile,
  type FsDirectoryHandle,
  type FsEntryHandle,
  type FsFileHandle,
} from "./directoryHandle";
import { ensureStoragePersistent } from "./opfs";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("folderImporter");

export interface FolderImportOpts extends AudioImportOpts {
  removeSong?: (songId: string) => void;
  silent?: boolean;
}

interface WebkitFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?(
    onSuccess: (file: File) => void,
    onError?: (error: unknown) => void,
  ): void;
  createReader?(): {
    readEntries(
      onSuccess: (entries: WebkitFileSystemEntry[]) => void,
      onError?: (error: unknown) => void,
    ): void;
  };
}

function toImportItems(audioFiles: DirectoryFile[]): ImportFileItem[] {
  return audioFiles.map((audioFile) => ({
    file: audioFile.file,
    path: audioFile.relativePath,
  }));
}

async function collectWebkitDirectory(
  entry: WebkitFileSystemEntry,
): Promise<File[]> {
  const reader = entry.createReader?.();
  if (!reader) return [];

  const collected: File[] = [];
  const readBatch = async (): Promise<void> => {
    const entries = await new Promise<WebkitFileSystemEntry[]>((resolve) => {
      reader.readEntries(resolve, () => resolve([]));
    });
    if (entries.length === 0) return;

    for (const child of entries) {
      if (child.isFile && child.file) {
        try {
          collected.push(
            await new Promise<File>((resolve, reject) =>
              child.file!(resolve, reject),
            ),
          );
        } catch {}
      } else if (child.isDirectory) {
        collected.push(...(await collectWebkitDirectory(child)));
      }
    }
    await readBatch();
  };

  await readBatch();
  return collected;
}

async function collectDropInputs(
  dataTransfer: DataTransfer,
): Promise<{ directories: FsDirectoryHandle[]; files: File[] }> {
  const directories: FsDirectoryHandle[] = [];
  const files: File[] = [];
  const items = Array.from(dataTransfer.items ?? []);

  if (items.length === 0) {
    files.push(...Array.from(dataTransfer.files ?? []));
    return { directories, files };
  }

  for (const item of items) {
    const anyItem = item as unknown as {
      getAsFileSystemHandle?: () => Promise<FsEntryHandle | null>;
      webkitGetAsEntry?: () => WebkitFileSystemEntry | null;
    };

    if (typeof anyItem.getAsFileSystemHandle === "function") {
      try {
        const handle = await anyItem.getAsFileSystemHandle();
        if (handle?.kind === "directory") {
          directories.push(handle as FsDirectoryHandle);
        } else if (handle?.kind === "file") {
          files.push(await (handle as FsFileHandle).getFile());
        }
      } catch {}
      continue;
    }

    const legacyEntry = anyItem.webkitGetAsEntry?.();
    if (legacyEntry) {
      if (legacyEntry.isDirectory) {
        try {
          files.push(...(await collectWebkitDirectory(legacyEntry)));
        } catch (error) {
          logger.warn("Failed to read dropped directory", {
            error: String(error),
          });
        }
      } else if (legacyEntry.isFile && legacyEntry.file) {
        try {
          files.push(
            await new Promise<File>((resolve, reject) =>
              legacyEntry.file!(resolve, reject),
            ),
          );
        } catch {}
      }
      continue;
    }

    const file = item.getAsFile();
    if (file) files.push(file);
  }

  return { directories, files };
}

export async function importFolderHandle(
  handle: FsDirectoryHandle,
  opts: FolderImportOpts,
  existing?: PersistedDirectory | null,
): Promise<{ dirId: string; added: number; removed: number }> {
  const granted = await ensureReadPermission(handle);
  if (!granted) {
    if (!opts.silent) {
      toast.error(
        opts.t("folder.permissionDenied", { name: handle.name || "" }),
      );
    }
    return { dirId: "", added: 0, removed: 0 };
  }

  const audioFiles = await collectAudioFiles(handle);
  const directoryName = handle.name?.trim() || "Folder";

  const record = await upsertDirectory(directoryName, handle, existing?.id);
  const previousEntries = existing?.entries ?? record.entries;

  const result =
    audioFiles.length > 0
      ? await importAudioFiles(
          toImportItems(audioFiles),
          opts.addSong,
          opts.t,
          opts.getExistingTracks,
          { sourceKind: "folderHandle", sourceId: record.id },
        )
      : null;

  if (result === null && !opts.silent) {
    toast.info(opts.t("folder.noAudio", { name: directoryName }));
  }

  const currentPaths = new Set(
    audioFiles.map((audioFile) => audioFile.relativePath),
  );
  let removed = 0;
  for (const [path, songId] of Object.entries(previousEntries)) {
    if (currentPaths.has(path)) continue;
    opts.removeSong?.(songId);
    removed++;
  }

  if (opts.getExistingTracks) {
    await reindexDirectory(record.id, opts.getExistingTracks());
  } else {
    await directoryStore.save({
      ...record,
      entries: Object.fromEntries(
        Object.entries(previousEntries).filter(([path]) =>
          currentPaths.has(path),
        ),
      ),
    });
  }

  return { dirId: record.id, added: result?.successCount ?? 0, removed };
}

export async function importFolder(
  opts: FolderImportOpts,
): Promise<{ imported: number } | null> {
  const handle = await pickDirectory();
  if (!handle) return null;
  const result = await importFolderHandle(handle, opts);
  return { imported: result.added };
}

export async function importFolderFiles(
  files: File[],
  opts: FolderImportOpts,
): Promise<{ imported: number }> {
  await ensureStoragePersistent();
  const result = await importAudioFiles(
    files.map((file) => ({ file, path: file.webkitRelativePath || file.name })),
    opts.addSong,
    opts.t,
    opts.getExistingTracks,
  );
  return { imported: result.successCount };
}

export async function importDataTransfer(
  dataTransfer: DataTransfer,
  opts: FolderImportOpts,
): Promise<{ imported: number }> {
  const { directories, files } = await collectDropInputs(dataTransfer);

  let imported = 0;
  for (const directory of directories) {
    try {
      const result = await importFolderHandle(directory, opts);
      imported += result.added;
    } catch (error) {
      logger.error("Failed to import dropped folder", {
        error: String(error),
      });
    }
  }

  if (files.length > 0) {
    const result = await importFolderFiles(files, opts);
    imported += result.imported;
  }

  return { imported };
}

export async function syncAllDirectories(
  opts: FolderImportOpts,
): Promise<void> {
  const directories = await directoryStore.loadAll();
  const summaries: Array<{ name: string; added: number; removed: number }> = [];

  for (const directory of directories) {
    const handle = directory.handle as unknown as FsDirectoryHandle;
    if (!handle?.queryPermission) continue;

    let state: PermissionState = "denied";
    try {
      state = await handle.queryPermission({ mode: "read" });
    } catch {
      continue;
    }
    if (state !== "granted") continue;

    const result = await importFolderHandle(handle, opts, directory);
    summaries.push({ name: directory.name, ...result });
  }

  if (summaries.length > 0 && !opts.silent) {
    const added = summaries.reduce((total, item) => total + item.added, 0);
    const removed = summaries.reduce((total, item) => total + item.removed, 0);
    toast.success(
      opts.t("folder.syncComplete", {
        added,
        removed,
        count: summaries.length,
      }),
    );
  }
}
