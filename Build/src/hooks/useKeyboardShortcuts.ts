import { useEffect, useCallback, useState } from 'react';
import { shortcutsDb, ShortcutConfig, KeyboardShortcut } from '../helpers/shortcutsIndexedDbHelper';

interface MusicPlayerHook {
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  playerState: {
    volume: number;
    shuffle: boolean;
    repeat: 'off' | 'one' | 'all';
    isMuted?: boolean;
  };
}

interface UseKeyboardShortcutsProps {
  musicPlayerHook: MusicPlayerHook;
  onOpenSettings?: () => void;
  onToggleLyrics?: () => void;
  onToggleVisualizer?: () => void;
  onSearch?: () => void;
}

export const useKeyboardShortcuts = ({
  musicPlayerHook,
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
        console.error('Failed to load keyboard shortcuts:', error);
        // Use default shortcuts as fallback
        setShortcuts(await shortcutsDb.getAllShortcuts());
      }
    };

    loadShortcuts();
  }, []);

  const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    return (
      event.key === shortcut.key &&
      (shortcut.ctrlKey || false) === event.ctrlKey &&
      (shortcut.altKey || false) === event.altKey &&
      (shortcut.shiftKey || false) === event.shiftKey
    );
  }, []);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Find matching shortcut
    const matchingShortcut = Object.values(shortcuts).find(shortcut => 
      matchesShortcut(event, shortcut)
    );

    if (!matchingShortcut) return;

    // Prevent default behavior for our shortcuts
    event.preventDefault();

    // Execute the appropriate action
    switch (matchingShortcut.action) {
      case 'playPause':
        musicPlayerHook.togglePlayPause();
        break;
      case 'nextSong':
        musicPlayerHook.playNext();
        break;
      case 'previousSong':
        musicPlayerHook.playPrevious();
        break;
      case 'volumeUp':
        const newVolumeUp = Math.min(1, musicPlayerHook.playerState.volume + 0.05);
        console.log('Volume up:', musicPlayerHook.playerState.volume, '->', newVolumeUp);
        musicPlayerHook.setVolume(newVolumeUp);
        break;
      case 'volumeDown':
        const newVolumeDown = Math.max(0, musicPlayerHook.playerState.volume - 0.05);
        console.log('Volume down:', musicPlayerHook.playerState.volume, '->', newVolumeDown);
        musicPlayerHook.setVolume(newVolumeDown);
        break;
      case 'mute':
        // Toggle mute by setting volume to 0 or restoring it
        const currentVolume = musicPlayerHook.playerState.volume;
        if (currentVolume > 0) {
          // Store current volume and mute
          sessionStorage.setItem('previousVolume', currentVolume.toString());
          musicPlayerHook.setVolume(0);
        } else {
          // Restore previous volume or default to 0.7
          const previousVolume = parseFloat(sessionStorage.getItem('previousVolume') || '0.7');
          musicPlayerHook.setVolume(previousVolume);
        }
        break;
      case 'toggleShuffle':
        musicPlayerHook.toggleShuffle();
        break;
      case 'toggleRepeat':
        musicPlayerHook.toggleRepeat();
        break;
      case 'toggleLyrics':
        onToggleLyrics?.();
        break;
      case 'toggleVisualizer':
        onToggleVisualizer?.();
        break;
      case 'search':
        onSearch?.();
        break;
      case 'openSettings':
        onOpenSettings?.();
        break;
    }
  }, [
    shortcuts,
    matchesShortcut,
    musicPlayerHook,
    onToggleLyrics,
    onToggleVisualizer,
    onSearch,
    onOpenSettings,
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Return current shortcuts and a function to reload them
  return {
    shortcuts,
    reloadShortcuts: async () => {
      const loadedShortcuts = await shortcutsDb.getAllShortcuts();
      setShortcuts(loadedShortcuts);
    }
  };
};