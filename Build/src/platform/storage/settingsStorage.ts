import type { SettingsState } from "../settings/types";
import { getDb, STORES, tx, req } from "./db";

const PREFIX = "settings.";

interface StoredSetting {
  key: string;
  value: unknown;
}

function settingKey(name: string): string {
  return `${PREFIX}${name}`;
}

export const settingsStorage = {
  async load(): Promise<Partial<SettingsState>> {
    const db = await getDb();
    const transaction = db.transaction([STORES.SETTINGS], "readonly");
    const records = await req<StoredSetting[]>(
      transaction.objectStore(STORES.SETTINGS).getAll(),
    );

    if (!Array.isArray(records)) return {};

    const loaded: Partial<SettingsState> = {};
    for (const record of records) {
      if (typeof record?.key === "string" && record.key.startsWith(PREFIX)) {
        const name = record.key.slice(PREFIX.length);
        (loaded as Record<string, unknown>)[name] = record.value;
      }
    }
    return loaded;
  },

  async save(changes: Partial<SettingsState>): Promise<void> {
    const entries: Array<[string, unknown]> = [];
    for (const [name, value] of Object.entries(changes)) {
      if (value !== undefined) entries.push([name, value]);
    }
    if (entries.length === 0) return;

    await tx(STORES.SETTINGS, "readwrite", (transaction) => {
      const store = transaction.objectStore(STORES.SETTINGS);
      return Promise.all(
        entries.map(([name, value]) =>
          req(store.put({ key: settingKey(name), value })),
        ),
      );
    });
  },
};
