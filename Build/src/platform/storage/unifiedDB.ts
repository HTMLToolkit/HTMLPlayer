const DB_NAME = "HTMLPlayer";
const DB_VERSION = 1;

export const STORES = {
  TRACKS: "tracks",
  PLAYLISTS: "playlists",
  FAVORITES: "favorites",
  SETTINGS: "settings",
} as const;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

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

      if (!db.objectStoreNames.contains(STORES.TRACKS)) {
        const trackStore = db.createObjectStore(STORES.TRACKS, { keyPath: "id" });
        trackStore.createIndex("artist", "artist", { unique: false });
        trackStore.createIndex("album", "album", { unique: false });
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
    };
  });

  return dbPromise;
}

export async function getDb(): Promise<IDBDatabase> {
  return openDatabase();
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(Object.values(STORES), "readwrite");
  
  for (const storeName of Object.values(STORES)) {
    tx.objectStore(storeName).clear();
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
