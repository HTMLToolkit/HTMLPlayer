import { getDb, STORES, tx, req } from "./db";
import { generateUniqueId } from "../metadata";
import type { FsDirectoryHandle } from "./directoryHandle";
import type { Track } from "../../core/engine/types";

export interface PersistedDirectory {
  id: string;
  name: string;
  handle: unknown;
  entries: Record<string, string>;
}

export const directoryStore = {
  async save(directory: PersistedDirectory): Promise<void> {
    await tx(STORES.DIRECTORY_HANDLES, "readwrite", (transaction) =>
      req(transaction.objectStore(STORES.DIRECTORY_HANDLES).put(directory)),
    );
  },

  async get(id: string): Promise<PersistedDirectory | null> {
    const db = await getDb();
    const transaction = db.transaction([STORES.DIRECTORY_HANDLES], "readonly");
    const found = await req(
      transaction.objectStore(STORES.DIRECTORY_HANDLES).get(id),
    );
    return isPersistedDirectory(found) ? found : null;
  },

  async loadAll(): Promise<PersistedDirectory[]> {
    const db = await getDb();
    const transaction = db.transaction([STORES.DIRECTORY_HANDLES], "readonly");
    const raw = await req(
      transaction.objectStore(STORES.DIRECTORY_HANDLES).getAll(),
    );
    return Array.isArray(raw) ? raw.filter(isPersistedDirectory) : [];
  },
};

export async function getDirectoryHandleById(
  id: string,
): Promise<FsDirectoryHandle | null> {
  const record = await directoryStore.get(id);
  if (!record) return null;
  return record.handle as FsDirectoryHandle | null;
}

export async function upsertDirectory(
  name: string,
  handle: unknown,
  id?: string,
): Promise<PersistedDirectory> {
  const matched =
    (await directoryStore.loadAll()).find(
      (directory) => directory.name === name,
    ) ?? null;
  const resolvedId = id ?? matched?.id ?? generateUniqueId();

  const record: PersistedDirectory = {
    id: resolvedId,
    name,
    handle,
    entries:
      (await directoryStore.get(resolvedId))?.entries ?? matched?.entries ?? {},
  };
  await directoryStore.save(record);
  return record;
}

export async function reindexDirectory(
  id: string,
  tracks: Track[],
): Promise<void> {
  const record = await directoryStore.get(id);
  if (!record) return;

  const entries: Record<string, string> = {};
  for (const track of tracks) {
    if (track.sourceId === id && track.path) {
      entries[track.path] = track.id;
    }
  }
  await directoryStore.save({ ...record, entries });
}

function isPersistedDirectory(value: unknown): value is PersistedDirectory {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    candidate.handle !== undefined
  );
}
