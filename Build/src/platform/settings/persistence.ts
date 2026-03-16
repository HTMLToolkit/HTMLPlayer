import type { SettingsState } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const SETTINGS_KEY = "htmlplayer-settings";

export class SettingsPersistence {
  async save(settings: SettingsState): Promise<void> {
    try {
      const serialized = JSON.stringify(settings);
      localStorage.setItem(SETTINGS_KEY, serialized);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  async load(): Promise<SettingsState> {
    try {
      const serialized = localStorage.getItem(SETTINGS_KEY);
      if (!serialized) {
        return { ...DEFAULT_SETTINGS };
      }

      const parsed = JSON.parse(serialized) as Partial<SettingsState>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (error) {
      console.error("Failed to load settings:", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (error) {
      console.error("Failed to clear settings:", error);
    }
  }

  async saveToIndexedDB(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["settings"], "readwrite");
      const store = transaction.objectStore("settings");

      const request = store.get("main");

      request.onsuccess = async () => {
        const existing = request.result;
        const data = existing
          ? { ...existing, value: await this.load() }
          : { key: "main", value: await this.load() };

        const putTransaction = db.transaction(["settings"], "readwrite");
        const putStore = putTransaction.objectStore("settings");
        putStore.put(data);

        putTransaction.oncomplete = () => resolve();
        putTransaction.onerror = () => reject(putTransaction.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async loadFromIndexedDB(db: IDBDatabase): Promise<SettingsState> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["settings"], "readonly");
      const store = transaction.objectStore("settings");
      const request = store.get("main");

      request.onsuccess = () => {
        const result = request.result as { key: string; value: SettingsState } | undefined;
        resolve(result?.value ?? { ...DEFAULT_SETTINGS });
      };

      request.onerror = () => reject(request.error);
    });
  }
}

export const settingsPersistence = new SettingsPersistence();