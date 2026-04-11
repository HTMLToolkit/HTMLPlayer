import { getDb, STORES } from "./unifiedDB";

export const settingsStorage = {
  async saveSetting(key: string, value: unknown): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORES.SETTINGS, "readwrite");
    const store = tx.objectStore(STORES.SETTINGS);
    store.put({ key, value });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async loadSetting<T>(key: string): Promise<T | null> {
    const db = await getDb();
    const tx = db.transaction(STORES.SETTINGS, "readonly");
    const store = tx.objectStore(STORES.SETTINGS);

    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result as { key: string; value: T } | undefined;
        resolve(result?.value ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  },
};
