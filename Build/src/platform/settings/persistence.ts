import type { SettingsState } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { createLogger } from "../../helpers/logger";
import {
  deserializeVersionedJson,
  sanitizeSettingsState,
  serializeVersioned,
  unwrapVersioned,
  withSchemaVersion,
} from "../validators";

const logger = createLogger("settingsPersistence");

const SETTINGS_KEY = "htmlplayer-settings";

export class SettingsPersistence {
  async save(settings: SettingsState): Promise<void> {
    try {
      localStorage.setItem(SETTINGS_KEY, serializeVersioned(settings));
    } catch (error) {
      logger.error("Failed to save settings:", { error: String(error) });
    }
  }

  async load(): Promise<SettingsState> {
    try {
      const serialized = localStorage.getItem(SETTINGS_KEY);
      const envelope = deserializeVersionedJson(serialized);
      if (!envelope) {
        return { ...DEFAULT_SETTINGS };
      }
      return sanitizeSettingsState(envelope.value, DEFAULT_SETTINGS);
    } catch (error) {
      logger.error("Failed to load settings:", { error: String(error) });
      return { ...DEFAULT_SETTINGS };
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (error) {
      logger.error("Failed to clear settings:", { error: String(error) });
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
          ? { ...existing, value: withSchemaVersion(await this.load()) }
          : { key: "main", value: withSchemaVersion(await this.load()) };

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
        const result = request.result as
          | { key: string; value: SettingsState }
          | undefined;
        resolve(
          unwrapVersioned(
            result?.value,
            (value) => sanitizeSettingsState(value, DEFAULT_SETTINGS),
            { ...DEFAULT_SETTINGS },
          ),
        );
      };

      request.onerror = () => reject(request.error);
    });
  }
}

export const settingsPersistence = new SettingsPersistence();
