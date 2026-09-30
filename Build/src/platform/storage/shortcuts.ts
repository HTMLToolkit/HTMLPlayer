import i18n from "i18next";
import { throwError } from "../../helpers/logger";
import { getDb, STORES, tx, req } from "./db";

export interface KeyboardShortcut {
  id: string;
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: string;
  description: string;
  category: string;
}

export interface ShortcutConfig {
  [actionId: string]: KeyboardShortcut;
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  playPause: {
    id: "playPause",
    key: " ",
    action: "playPause",
    description: "settings.shortcuts.playPause",
    category: "playback",
  },
  nextSong: {
    id: "nextSong",
    key: "ArrowRight",
    action: "nextSong",
    description: "settings.shortcuts.nextSong",
    category: "playback",
  },
  previousSong: {
    id: "previousSong",
    key: "ArrowLeft",
    action: "previousSong",
    description: "settings.shortcuts.previousSong",
    category: "playback",
  },
  volumeUp: {
    id: "volumeUp",
    key: "ArrowUp",
    action: "volumeUp",
    description: "settings.shortcuts.volumeUpAction",
    category: "audio",
  },
  volumeDown: {
    id: "volumeDown",
    key: "ArrowDown",
    action: "volumeDown",
    description: "settings.shortcuts.volumeDownAction",
    category: "audio",
  },
  mute: {
    id: "mute",
    key: "m",
    action: "mute",
    description: "settings.shortcuts.mute",
    category: "audio",
  },
  toggleShuffle: {
    id: "toggleShuffle",
    key: "s",
    action: "toggleShuffle",
    description: "settings.shortcuts.toggleShuffleAction",
    category: "playback",
  },
  toggleRepeat: {
    id: "toggleRepeat",
    key: "r",
    action: "toggleRepeat",
    description: "settings.shortcuts.toggleRepeatAction",
    category: "playback",
  },
  toggleLyrics: {
    id: "toggleLyrics",
    key: "l",
    action: "toggleLyrics",
    description: "settings.shortcuts.toggleLyricsAction",
    category: "interface",
  },
  toggleVisualizer: {
    id: "toggleVisualizer",
    key: "v",
    action: "toggleVisualizer",
    description: "settings.shortcuts.toggleVisualizerAction",
    category: "interface",
  },
  search: {
    id: "search",
    key: "f",
    ctrlKey: true,
    action: "search",
    description: "settings.shortcuts.openSearch",
    category: "navigation",
  },
  openSettings: {
    id: "openSettings",
    key: ",",
    ctrlKey: true,
    action: "openSettings",
    description: "settings.shortcuts.openSettingsAction",
    category: "navigation",
  },
};

class ShortcutsIndexedDbHelper {
  async getAllShortcuts(): Promise<ShortcutConfig> {
    const db = await getDb();
    const transaction = db.transaction([STORES.SHORTCUTS], "readonly");
    const shortcuts = await req<KeyboardShortcut[]>(
      transaction.objectStore(STORES.SHORTCUTS).getAll(),
    );

    if (shortcuts.length === 0) {
      await this.saveAllShortcuts(DEFAULT_SHORTCUTS);
      return DEFAULT_SHORTCUTS;
    }

    const config: ShortcutConfig = {};
    for (const shortcut of shortcuts) {
      config[shortcut.id] = shortcut;
    }
    return config;
  }

  async saveShortcut(shortcut: KeyboardShortcut): Promise<void> {
    if (!shortcut.id) {
      return throwError("Shortcut must have an id property");
    }
    if (!shortcut.key) {
      return throwError("Shortcut must have a key property");
    }
    if (!shortcut.action) {
      return throwError("Shortcut must have an action property");
    }

    try {
      await tx(STORES.SHORTCUTS, "readwrite", (transaction) =>
        req(transaction.objectStore(STORES.SHORTCUTS).put(shortcut)),
      );
    } catch {
      throw new Error(i18n.t("settings.shortcuts.failedToSaveGeneral"));
    }
  }

  async saveAllShortcuts(shortcuts: ShortcutConfig): Promise<void> {
    await tx(STORES.SHORTCUTS, "readwrite", (transaction) => {
      const store = transaction.objectStore(STORES.SHORTCUTS);
      store.clear();
      return Promise.all(
        Object.values(shortcuts).map((shortcut) =>
          req(store.add(shortcut)).catch(() => {
            throw new Error(
              i18n.t("settings.shortcuts.failedToSave") + ` ${shortcut.id}`,
            );
          }),
        ),
      );
    });
  }

  async resetToDefaults(): Promise<void> {
    await this.saveAllShortcuts(DEFAULT_SHORTCUTS);
  }

  async deleteShortcut(shortcutId: string): Promise<void> {
    try {
      await tx(STORES.SHORTCUTS, "readwrite", (transaction) =>
        req(transaction.objectStore(STORES.SHORTCUTS).delete(shortcutId)),
      );
    } catch {
      throw new Error("Failed to delete shortcut");
    }
  }

  async isShortcutConflict(
    shortcut: KeyboardShortcut,
    excludeId?: string,
  ): Promise<boolean> {
    const allShortcuts = await this.getAllShortcuts();

    return Object.values(allShortcuts).some((existing) => {
      if (excludeId && existing.id === excludeId) {
        return false;
      }

      return (
        existing.key === shortcut.key &&
        (existing.ctrlKey || false) === (shortcut.ctrlKey || false) &&
        (existing.altKey || false) === (shortcut.altKey || false) &&
        (existing.shiftKey || false) === (shortcut.shiftKey || false)
      );
    });
  }
}

export const shortcutsDb = new ShortcutsIndexedDbHelper();

export function formatShortcutKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push("Ctrl");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.shiftKey) parts.push("Shift");

  let key = shortcut.key;
  if (key === " ") key = "Space";
  else if (key === "ArrowUp") key = "↑";
  else if (key === "ArrowDown") key = "↓";
  else if (key === "ArrowLeft") key = "←";
  else if (key === "ArrowRight") key = "→";
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join(" + ");
}

export function parseKeyEvent(event: KeyboardEvent): Partial<KeyboardShortcut> {
  return {
    key: event.key,
    ctrlKey: event.ctrlKey || undefined,
    altKey: event.altKey || undefined,
    shiftKey: event.shiftKey || undefined,
  };
}

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut,
): boolean {
  return (
    event.key === shortcut.key &&
    (shortcut.ctrlKey || false) === event.ctrlKey &&
    (shortcut.altKey || false) === event.altKey &&
    (shortcut.shiftKey || false) === event.shiftKey
  );
}
