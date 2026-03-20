import { useEffect, useState, useRef } from "react";
import {
  shortcutsDb,
  matchesShortcut,
  type ShortcutConfig,
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
  const callbacksRef = useRef({
    onOpenSettings,
    onToggleLyrics,
    onToggleVisualizer,
    onSearch,
  });

  useEffect(() => {
    shortcutsDb.getAllShortcuts().then(setShortcuts).catch(console.error);
  }, []);

  useEffect(() => {
    callbacksRef.current = {
      onOpenSettings,
      onToggleLyrics,
      onToggleVisualizer,
      onSearch,
    };
  }, [onOpenSettings, onToggleLyrics, onToggleVisualizer, onSearch]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      const tourElement = document.querySelector('[data-tour-elem="popover"]');
      if (tourElement) return;

      const matchingShortcut = Object.values(shortcuts).find((shortcut) =>
        matchesShortcut(event, shortcut),
      );
      if (!matchingShortcut) return;

      event.preventDefault();

      const { onOpenSettings, onToggleLyrics, onToggleVisualizer, onSearch } =
        callbacksRef.current;

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
          komorebi.setVolume(Math.min(1, komorebi.volume + 0.05));
          break;
        case "volumeDown":
          komorebi.setVolume(Math.max(0, komorebi.volume - 0.05));
          break;
        case "mute": {
          const currentVolume = komorebi.volume;
          if (currentVolume > 0) {
            sessionStorage.setItem("previousVolume", currentVolume.toString());
            komorebi.setVolume(0);
          } else {
            komorebi.setVolume(
              parseFloat(sessionStorage.getItem("previousVolume") || "0.7"),
            );
          }
          break;
        }
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
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [komorebi, shortcuts]);

  return {
    shortcuts,
    reloadShortcuts: () => shortcutsDb.getAllShortcuts().then(setShortcuts),
  };
};
