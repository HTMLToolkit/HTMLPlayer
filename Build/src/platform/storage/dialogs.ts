import { getDb, STORES } from "./db";

export const dialogStorage = {
  async shouldShow(dialogKey: string): Promise<boolean> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.SETTINGS, "readonly");
      const store = tx.objectStore(STORES.SETTINGS);

      const result = await new Promise<any>((resolve, reject) => {
        const req = store.get(`dialog-${dialogKey}`);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      return result?.data?.dontShowAgain !== true;
    } catch (error) {
      console.error(`Failed to check dialog preference for ${dialogKey}:`, error);
      return true;
    }
  },

  async setPreference(dialogKey: string, dontShowAgain: boolean): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.SETTINGS, "readwrite");
      const store = tx.objectStore(STORES.SETTINGS);

      await new Promise<void>((resolve, reject) => {
        const req = store.put({
          id: `dialog-${dialogKey}`,
          data: { dontShowAgain, timestamp: Date.now() },
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error(`Failed to save dialog preference for ${dialogKey}:`, error);
      throw error;
    }
  },

  async resetAll(): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.SETTINGS, "readwrite");
      const store = tx.objectStore(STORES.SETTINGS);

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
    } catch (error) {
      console.error("Failed to reset dialog preferences:", error);
      throw error;
    }
  },
};
