const DB_NAME = "HTMLPlayerDB";
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export const STORES = {
  LIBRARY: "library",
  SETTINGS: "settings",
  AUDIO_DATA: "audioData",
  ALBUM_ART: "albumArt",
} as const;

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.LIBRARY)) {
        db.createObjectStore(STORES.LIBRARY, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.AUDIO_DATA)) {
        const store = db.createObjectStore(STORES.AUDIO_DATA, { keyPath: "songId" });
        store.createIndex("lastAccessed", "lastAccessed", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.ALBUM_ART)) {
        db.createObjectStore(STORES.ALBUM_ART, { keyPath: "songId" });
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
