import { getDb, STORES, tx, req } from "./db";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("dialogStorage");

const PREFIX = "dialog-";

interface StoredPreference {
  key: string;
  data: { dontShowAgain?: boolean; timestamp?: number };
}

function prefKey(dialogKey: string): string {
  return `${PREFIX}${dialogKey}`;
}

function isStoredPreference(value: unknown): value is StoredPreference {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).key === "string"
  );
}

export const dialogStorage = {
  async shouldShow(dialogKey: string): Promise<boolean> {
    try {
      const db = await getDb();
      const transaction = db.transaction([STORES.SETTINGS], "readonly");
      const stored = await req<StoredPreference | undefined>(
        transaction.objectStore(STORES.SETTINGS).get(prefKey(dialogKey)),
      );
      return stored?.data?.dontShowAgain !== true;
    } catch (error) {
      logger.error(`Failed to check dialog preference for ${dialogKey}:`, {
        error: String(error),
      });
      return true;
    }
  },

  async setPreference(
    dialogKey: string,
    dontShowAgain: boolean,
  ): Promise<void> {
    try {
      await tx(STORES.SETTINGS, "readwrite", (transaction) =>
        req(
          transaction.objectStore(STORES.SETTINGS).put({
            key: prefKey(dialogKey),
            data: { dontShowAgain, timestamp: Date.now() },
          }),
        ),
      );
    } catch (error) {
      logger.error(`Failed to save dialog preference for ${dialogKey}:`, {
        error: String(error),
      });
      throw error;
    }
  },

  async resetAll(): Promise<void> {
    try {
      const db = await getDb();
      const transaction = db.transaction([STORES.SETTINGS], "readonly");
      const records = await req<StoredPreference[]>(
        transaction.objectStore(STORES.SETTINGS).getAll(),
      );
      const keys = Array.isArray(records)
        ? records
            .filter(isStoredPreference)
            .map((record) => record.key)
            .filter((key) => key.startsWith(PREFIX))
        : [];

      if (keys.length === 0) return;

      await tx(STORES.SETTINGS, "readwrite", (transaction) => {
        const store = transaction.objectStore(STORES.SETTINGS);
        return Promise.all(keys.map((key) => req(store.delete(key))));
      });
    } catch (error) {
      logger.error("Failed to reset dialog preferences:", {
        error: String(error),
      });
      throw error;
    }
  },
};
