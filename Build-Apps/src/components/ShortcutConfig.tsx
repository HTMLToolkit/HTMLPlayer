import React, { useEffect, useState } from "react";
import { shortcutsDb, KeyboardShortcut, formatShortcutKey, parseKeyEvent, DEFAULT_SHORTCUTS } from "../helpers/shortcutsIndexedDbHelper";
import type { ShortcutConfig as ShortcutConfigType } from "../helpers/shortcutsIndexedDbHelper";
import { Button } from "./Button";
import { Pencil, Save, X } from "lucide-react";
import styles from "./Settings.module.css";

interface ShortcutConfigProps {
  onShortcutsChanged?: () => void;
}

export const ShortcutConfig: React.FC<ShortcutConfigProps> = ({ onShortcutsChanged }) => {
  const [shortcuts, setShortcuts] = useState<ShortcutConfigType>({});
  const [mergedShortcuts, setMergedShortcuts] = useState<ShortcutConfigType>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<Partial<KeyboardShortcut>>({});
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    shortcutsDb.getAllShortcuts().then((userShortcuts) => {
      setShortcuts(userShortcuts);
      // Always merge with defaults to show all actions
      setMergedShortcuts({ ...DEFAULT_SHORTCUTS, ...userShortcuts });
    });
  }, []);

  const handleEdit = (id: string) => {
    setEditingId(id);
    setEditValue(shortcuts[id] || {});
    setConflict(null);
  };

  const handleKeyCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const keyData = parseKeyEvent(e.nativeEvent);
    setEditValue({ ...shortcuts[editingId!], ...keyData });
  };

  const getDisplayValue = () => {
    if (!editValue || !editValue.key) return "Press a key...";
    return formatShortcutKey(editValue as KeyboardShortcut);
  };

  const handleSave = async () => {
    if (!editingId || !editValue.key) return;
    
    // Ensure we have a base shortcut to work with
    const baseShortcut = shortcuts[editingId] || mergedShortcuts[editingId];
    if (!baseShortcut) {
      setConflict("Unable to find shortcut configuration.");
      return;
    }
    
    const newShortcut: KeyboardShortcut = {
      ...baseShortcut,
      ...editValue,
      id: editingId, // Ensure id is always set
    };
    
    const isConflict = await shortcutsDb.isShortcutConflict(newShortcut, editingId);
    if (isConflict) {
      setConflict("Shortcut conflicts with another action.");
      return;
    }
    try {
      await shortcutsDb.saveShortcut(newShortcut);
      const updated = await shortcutsDb.getAllShortcuts();
      setShortcuts(updated);
      setMergedShortcuts({ ...DEFAULT_SHORTCUTS, ...updated });
      setEditingId(null);
      setEditValue({});
      setConflict(null);
      onShortcutsChanged?.();
    } catch (error) {
      console.error('Failed to save shortcut:', error);
      setConflict(error instanceof Error ? error.message : "Failed to save shortcut.");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue({});
    setConflict(null);
  };

  return (
    <div className={styles.shortcutConfigPanel}>
      <h4>Keyboard Shortcuts</h4>
      <div className={styles.shortcutConfigList}>
        {Object.keys(mergedShortcuts).length > 0 && Object.values(mergedShortcuts).map((shortcut) => {
          if (!shortcut || !shortcut.id) return null;
          return (
            <div key={shortcut.id} className={styles.shortcutConfigItem}>
              <span className={styles.shortcutConfigLabel}>{shortcut.description}</span>
              {editingId === shortcut.id ? (
                <>
                  <input
                    autoFocus
                    readOnly
                    className={styles.shortcutConfigInput}
                    value={getDisplayValue()}
                    onKeyDown={handleKeyCapture}
                    placeholder="Press new key..."
                    style={{ width: 120 }}
                  />
                  <Button size="sm" onClick={handleSave} title="Save shortcut">
                    <Save size={16} />
                  </Button>
                  <Button size="sm" onClick={handleCancel} title="Cancel">
                    <X size={16} />
                  </Button>
                  {conflict && <span className={styles.shortcutConflict}>{conflict}</span>}
                </>
              ) : (
                <>
                  <span className={styles.shortcutConfigKey}>{formatShortcutKey(shortcut)}</span>
                  <Button size="sm" onClick={() => handleEdit(shortcut.id)} title="Edit shortcut">
                    <Pencil size={16} />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
