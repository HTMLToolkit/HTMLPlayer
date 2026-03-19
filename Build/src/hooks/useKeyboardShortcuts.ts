import { useEffect, useCallback, useState } from "react";
import {
  shortcutsDb,
  ShortcutConfig,
  KeyboardShortcut,
} from "../platform/storage/shortcuts";
import type { UseKomorebiReturn } from "./useKomorebi";

interface UseKeyboardShortcutsProps {
  komorebi: UseKomorebiReturn;
  onOpenSettings?: () => void;
  onToggleLyrics?: () => void;
  onToggleVisualizer?: () => void;
  onSearch?: () => void;
}

export const useKeyboardShortcuts = ({
  komorebi,
  onOpenSettings,
  onToggleLyrics,
  onToggleVisualizer,
  onSearch,
}: UseKeyboardShortcutsProps) => {
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>({});

  // Load shortcuts from IndexedDB on mount
  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        const loadedShortcuts = await shortcutsDb.getAllShortcuts();
        setShortcuts(loadedShortcuts);
      } catch (error) {
        console.error("Failed to load keyboard shortcuts:", error);
        // Use default shortcuts as fallback
        setShortcuts(await shortcutsDb.getAllShortcuts());
      }
    };

    loadShortcuts();
  }, []);

  const matchesShortcut = useCallback(
    (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
      return (
        event.key === shortcut.key &&
        (shortcut.ctrlKey || false) === event.ctrlKey &&
        (shortcut.altKey || false) === event.altKey &&
        (shortcut.shiftKey || false) === event.shiftKey
      );
    },
    [],
  );

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore if tour/help guide is open
      const tourElement = document.querySelector('[data-tour-elem="popover"]');
      if (tourElement) {
        return;
      }

      // Find matching shortcut
      const matchingShortcut = Object.values(shortcuts).find((shortcut) =>
        matchesShortcut(event, shortcut),
      );

      if (!matchingShortcut) return;

      // Prevent default behavior for our shortcuts
      event.preventDefault();

      // Execute the appropriate action
      switch (matchingShortcut.action) {
        case "playPause":
          komorebi.togglePlayPause();
          break;
        case "nextSong":
          komorebi.next();
          break;
        case "previousSong":
          komorebi.previous();
          break;
        case "volumeUp":
          const newVolumeUp = Math.min(1, komorebi.volume + 0.05);
          komorebi.setVolume(newVolumeUp);
          break;
        case "volumeDown":
          const newVolumeDown = Math.max(0, komorebi.volume - 0.05);
          komorebi.setVolume(newVolumeDown);
          break;
        case "mute":
          const currentVolume = komorebi.volume;
          if (currentVolume > 0) {
            sessionStorage.setItem("previousVolume", currentVolume.toString());
            komorebi.setVolume(0);
          } else {
            const previousVolume = parseFloat(
              sessionStorage.getItem("previousVolume") || "0.7",
            );
            komorebi.setVolume(previousVolume);
          }
          break;
        case "toggleShuffle":
          komorebi.toggleShuffle();
          break;
        case "toggleRepeat":
          komorebi.toggleRepeat();
          break;
        case "toggleLyrics":
          onToggleLyrics?.();
          break;
        case "toggleVisualizer":
          onToggleVisualizer?.();
          break;
        case "search":
          onSearch?.();
          break;
        case "openSettings":
          onOpenSettings?.();
          break;
      }
    },
    [
      shortcuts,
      matchesShortcut,
      komorebi,
      onToggleLyrics,
      onToggleVisualizer,
      onSearch,
      onOpenSettings,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  // Return current shortcuts and a function to reload them
  return {
    shortcuts,
    reloadShortcuts: async () => {
      const loadedShortcuts = await shortcutsDb.getAllShortcuts();
      setShortcuts(loadedShortcuts);
    },
  };
};
