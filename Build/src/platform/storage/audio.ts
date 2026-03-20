const DB_NAME = "HTMLPlayerDB";
const DB_VERSION = 2;
const STORE = "audioData";

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "songId" });
        store.createIndex("lastAccessed", "lastAccessed", { unique: false });
      }
    };
  });
};

export interface AudioData {
  fileData: ArrayBuffer;
  mimeType: string;
}

export const audioStorage = {
  async load(songId: string): Promise<AudioData | null> {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readwrite");
      const store = tx.objectStore(STORE);

      const result = await new Promise<any>((resolve, reject) => {
        const req = store.get(songId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (result) {
        store.put({ ...result, lastAccessed: Date.now() });
      }

      db.close();
      return result
        ? { fileData: result.fileData, mimeType: result.mimeType }
        : null;
    } catch (error) {
      console.error(`Failed to load audio data for song ${songId}:`, error);
      return null;
    }
  },

  async save(songId: string, audioData: AudioData): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readwrite");
      const store = tx.objectStore(STORE);

      await new Promise<void>((resolve, reject) => {
        const req = store.put({
          songId,
          fileData: audioData.fileData,
          mimeType: audioData.mimeType,
          lastAccessed: Date.now(),
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      db.close();
    } catch (error) {
      console.error(`Failed to save audio data for song ${songId}:`, error);
      throw error;
    }
  },

  async remove(songId: string): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readwrite");
      const store = tx.objectStore(STORE);

      await new Promise<void>((resolve, reject) => {
        const req = store.delete(songId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      db.close();
    } catch (error) {
      console.error(`Failed to remove audio data for song ${songId}:`, error);
      throw error;
    }
  },
};
