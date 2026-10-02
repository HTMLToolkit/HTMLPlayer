import { createLogger } from "../../helpers/logger";
import { saveAudio } from "./opfs";

const logger = createLogger("db");

const DB_NAME = "HTMLPlayer";
const DB_VERSION = 3;

const LEGACY_DB_NAMES = ["HTMLPlayerDB", "HTMLPlayerShortcuts"];
const LEGACY_TRACKS_STORE = "tracks";

export const STORES = {
  METADATA: "metadata",
  PLAYLISTS: "playlists",
  FAVORITES: "favorites",
  SETTINGS: "settings",
  ALBUM_ART: "albumArt",
  SHORTCUTS: "shortcuts",
  DIRECTORY_HANDLES: "directoryHandles",
  META: "meta",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export const PENDING_AUDIO_FIELD = "pendingAudio";

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function deleteLegacyDatabases(): void {
  for (const name of LEGACY_DB_NAMES) {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onerror = () => {};
      request.onblocked = () => {};
    } catch {}
  }
}

function migrateLegacyTracks(transaction: IDBTransaction): void {
  const legacy = transaction.objectStore(LEGACY_TRACKS_STORE);
  const metadata = transaction.objectStore(STORES.METADATA);
  const cursorRequest = legacy.openCursor();

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;

    const { audioData, lastAccessed, ...track } = cursor.value as Record<
      string,
      unknown
    >;

    metadata.put({
      ...track,
      url: "",
      hasStoredAudio: track.hasStoredAudio === true,
      ...(audioData ? { [PENDING_AUDIO_FIELD]: audioData } : {}),
    });

    cursor.continue();
  };
}

async function migratePendingAudio(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction([STORES.METADATA], "readonly");
  const records = await req<unknown[]>(
    transaction.objectStore(STORES.METADATA).getAll(),
  );

  const pending = records.filter(
    (record): record is Record<string, unknown> =>
      isPlainObject(record) &&
      record[PENDING_AUDIO_FIELD] instanceof ArrayBuffer,
  );
  if (pending.length === 0) return;

  for (const record of pending) {
    const id = record.id;
    const audio = record[PENDING_AUDIO_FIELD] as ArrayBuffer;
    if (typeof id !== "string") continue;

    const { [PENDING_AUDIO_FIELD]: _audio, ...rest } = record;

    try {
      await saveAudio(id, new Blob([audio]));
      await tx(STORES.METADATA, "readwrite", (write) =>
        write.objectStore(STORES.METADATA).put(rest),
      );
    } catch (error) {
      logger.error(`Failed to migrate audio for track ${id}:`, {
        error: String(error),
      });
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  deleteLegacyDatabases();

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let migratedTracks = false;

    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("HTMLPlayer database upgrade blocked by another tab"));

    request.onsuccess = async () => {
      dbInstance = request.result;
      if (migratedTracks) {
        try {
          await migratePendingAudio(dbInstance);
        } catch (error) {
          logger.error("Failed to migrate legacy track audio:", {
            error: String(error),
          });
        }
      }
      resolve(dbInstance);
    };

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        const store = db.createObjectStore(STORES.METADATA, {
          keyPath: "id",
        });
        store.createIndex("artist", "artist", { unique: false });
        store.createIndex("album", "album", { unique: false });
      }

      if (db.objectStoreNames.contains(LEGACY_TRACKS_STORE)) {
        migrateLegacyTracks(request.transaction!);
        migratedTracks = true;
        db.deleteObjectStore(LEGACY_TRACKS_STORE);
      }

      if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
        db.createObjectStore(STORES.PLAYLISTS, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
        db.createObjectStore(STORES.FAVORITES, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORES.ALBUM_ART)) {
        db.createObjectStore(STORES.ALBUM_ART, { keyPath: "songId" });
      }

      if (!db.objectStoreNames.contains(STORES.SHORTCUTS)) {
        const store = db.createObjectStore(STORES.SHORTCUTS, {
          keyPath: "id",
        });
        store.createIndex("action", "action", { unique: true });
      }

      if (!db.objectStoreNames.contains(STORES.DIRECTORY_HANDLES)) {
        db.createObjectStore(STORES.DIRECTORY_HANDLES, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: "key" });
      }
    };
  });

  return dbPromise;
}

export function getDb(): Promise<IDBDatabase> {
  return openDatabase();
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

export function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function tx<T>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await getDb();
  const names = Array.isArray(stores) ? stores : [stores];
  const transaction = db.transaction(names, mode);

  let result: T;

  return new Promise<T>((resolve, reject) => {
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    Promise.resolve(run(transaction)).then(
      (value) => {
        result = value;
      },
      (error) => reject(error),
    );
  });
}
