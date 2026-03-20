const DB_NAME = "HTMLPlayerDB";
const DB_VERSION = 2;
const STORE = "settings";

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
};

export const dialogStorage = {
  async shouldShow(dialogKey: string): Promise<boolean> {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readonly");
      const store = tx.objectStore(STORE);

      const result = await new Promise<any>((resolve, reject) => {
        const req = store.get(`dialog-${dialogKey}`);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      db.close();
      return result?.data?.dontShowAgain !== true;
    } catch (error) {
      console.error(`Failed to check dialog preference for ${dialogKey}:`, error);
      return true;
    }
  },

  async setPreference(dialogKey: string, dontShowAgain: boolean): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readwrite");
      const store = tx.objectStore(STORE);

      await new Promise<void>((resolve, reject) => {
        const req = store.put({
          id: `dialog-${dialogKey}`,
          data: { dontShowAgain, timestamp: Date.now() },
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      db.close();
    } catch (error) {
      console.error(`Failed to save dialog preference for ${dialogKey}:`, error);
      throw error;
    }
  },

  async resetAll(): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE], "readwrite");
      const store = tx.objectStore(STORE);

      const keys = await new Promise<string[]>((resolve, reject) => {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
        req.onerror = () => reject(req.error);
      });

      await Promise.all(
        keys
          .filter((key) => key.startsWith("dialog-"))
          .map((key) =>
            new Promise<void>((resolve, reject) => {
              const req = store.delete(key);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            })
          )
      );

      db.close();
    } catch (error) {
      console.error("Failed to reset dialog preferences:", error);
      throw error;
    }
  },
};
