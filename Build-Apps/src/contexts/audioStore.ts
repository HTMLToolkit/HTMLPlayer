import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useEffect, useRef } from 'react';
import { Song } from '../hooks/musicPlayerHook';

export interface AudioEvent {
  type: 'play' | 'pause' | 'seek' | 'volume' | 'next' | 'previous' | 'timeUpdate' | 'songChange';
  payload?: any;
  timestamp: number;
  source: 'main' | 'pip';
}

interface AudioState {
  // Current audio state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  currentSong: Song | null;
  
  // Event handling
  lastEvent: AudioEvent | null;
  
  // Actions for state updates (internal use)
  setPlaying: (playing: boolean, source?: 'main' | 'pip') => void;
  setCurrentTime: (time: number, source?: 'main' | 'pip') => void;
  setVolume: (volume: number, source?: 'main' | 'pip') => void;
  setCurrentSong: (song: Song | null, source?: 'main' | 'pip') => void;
  setDuration: (duration: number, source?: 'main' | 'pip') => void;
  
  // Control actions that emit events
  play: (source?: 'main' | 'pip') => void;
  pause: (source?: 'main' | 'pip') => void;
  seek: (time: number, source?: 'main' | 'pip') => void;
  next: (source?: 'main' | 'pip') => void;
  previous: (source?: 'main' | 'pip') => void;
  updateTime: (time: number, source?: 'main' | 'pip') => void;
  changeVolume: (volume: number, source?: 'main' | 'pip') => void;
}

// Create BroadcastChannel for cross-window communication
const audioChannel = new BroadcastChannel('audio-events');

export const useAudioStore = create<AudioState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.75,
    currentSong: null,
    lastEvent: null,

    // State setters (for internal sync, don't broadcast)
    setPlaying: (playing: boolean, _source: 'main' | 'pip' = 'main') => {
      set({ isPlaying: playing });
    },

    setCurrentTime: (time: number, _source: 'main' | 'pip' = 'main') => {
      set({ currentTime: time });
    },

    setVolume: (volume: number, _source: 'main' | 'pip' = 'main') => {
      set({ volume });
    },

    setCurrentSong: (song: Song | null, source: 'main' | 'pip' = 'main') => {
      set({ currentSong: song });
      // Broadcast song changes
      const event: AudioEvent = {
        type: 'songChange',
        payload: { song },
        timestamp: Date.now(),
        source
      };
      set({ lastEvent: event });
      audioChannel.postMessage(event);
    },

    setDuration: (duration: number, _source: 'main' | 'pip' = 'main') => {
      set({ duration });
    },

    // Control actions (these broadcast events)
    play: (source: 'main' | 'pip' = 'main') => {
      const event: AudioEvent = {
        type: 'play',
        timestamp: Date.now(),
        source
      };
      set({ lastEvent: event });
      audioChannel.postMessage(event);
    },

    pause: (source: 'main' | 'pip' = 'main') => {
      const event: AudioEvent = {
        type: 'pause',
        timestamp: Date.now(),
        source
      };
      set({ lastEvent: event });
      audioChannel.postMessage(event);
    },

    seek: (time: number, source: 'main' | 'pip' = 'main') => {
      const event: AudioEvent = {
        type: 'seek',
        payload: { time },
        timestamp: Date.now(),
        source
      };
      set({ lastEvent: event });
      audioChannel.postMessage(event);
    },

    next: (source: 'main' | 'pip' = 'main') => {
      const event: AudioEvent = {
        type: 'next',
        timestamp: Date.now(),
        source
      };
      set({ lastEvent: event });
      audioChannel.postMessage(event);
    },

    previous: (source: 'main' | 'pip' = 'main') => {
      const event: AudioEvent = {
        type: 'previous',
        timestamp: Date.now(),
        source
      };
      set({ lastEvent: event });
      audioChannel.postMessage(event);
    },

    updateTime: (time: number, source: 'main' | 'pip' = 'main') => {
      set({ currentTime: time });
      // Only broadcast time updates every 500ms to avoid spam
      const now = Date.now();
      const lastEvent = get().lastEvent;
      if (!lastEvent || lastEvent.type !== 'timeUpdate' || now - lastEvent.timestamp > 500) {
        const event: AudioEvent = {
          type: 'timeUpdate',
          payload: { time },
          timestamp: now,
          source
        };
        set({ lastEvent: event });
        audioChannel.postMessage(event);
      }
    },

    changeVolume: (volume: number, source: 'main' | 'pip' = 'main') => {
      set({ volume });
      const event: AudioEvent = {
        type: 'volume',
        payload: { volume },
        timestamp: Date.now(),
        source
      };
      set({ lastEvent: event });
      audioChannel.postMessage(event);
    },
  }))
);

// Listen for events from other windows/tabs
audioChannel.onmessage = (event) => {
  const audioEvent: AudioEvent = event.data;
  const store = useAudioStore.getState();
  
  // Determine if this is the main window or PiP window
  const isMainWindow = typeof window !== 'undefined' && window.parent === window;
  const currentSource = isMainWindow ? 'main' : 'pip';
  
  // Prevent infinite loops by checking source
  if (audioEvent.source === currentSource) {
    return;
  }

  console.log(`[${currentSource}] Received audio event:`, audioEvent.type, 'from', audioEvent.source);

  // Handle incoming events (update state without broadcasting)
  switch (audioEvent.type) {
    case 'play':
      store.setPlaying(true, audioEvent.source);
      break;
    case 'pause':
      store.setPlaying(false, audioEvent.source);
      break;
    case 'volume':
      store.setVolume(audioEvent.payload.volume, audioEvent.source);
      break;
    case 'seek':
      store.setCurrentTime(audioEvent.payload.time, audioEvent.source);
      break;
    case 'timeUpdate':
      store.setCurrentTime(audioEvent.payload.time, audioEvent.source);
      break;
    case 'songChange':
      store.setCurrentSong(audioEvent.payload.song, audioEvent.source);
      break;
    // next/previous are handled by the audio sync hook
  }
};

// Hook for subscribing to specific events
export const useAudioEvents = (eventType: AudioEvent['type'], callback: (event: AudioEvent) => void) => {
  const lastEvent = useAudioStore((state) => state.lastEvent);
  const lastProcessedEventRef = useRef<number>(0);
  
  useEffect(() => {
    if (lastEvent && 
        lastEvent.type === eventType && 
        lastEvent.timestamp !== lastProcessedEventRef.current) {
      
      // Simple deduplication: only process events that are recent (less than 1000ms old)
      const now = Date.now();
      if (now - lastEvent.timestamp < 1000) {
        lastProcessedEventRef.current = lastEvent.timestamp;
        callback(lastEvent);
      }
    }
  }, [lastEvent, eventType]); // Remove callback from dependencies to prevent infinite loops
};

// Hook for audio controls
export const useAudioControls = () => {
  const { play, pause, seek, next, previous, changeVolume } = useAudioStore();
  const isPlaying = useAudioStore((state) => state.isPlaying);
  
  return {
    play,
    pause,
    seek,
    next,
    previous,
    setVolume: changeVolume,
    togglePlayPause: () => isPlaying ? pause() : play(),
  };
};

// Hook for audio state
export const useAudioState = () => {
  return useAudioStore((state) => ({
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    duration: state.duration,
    volume: state.volume,
    currentSong: state.currentSong,
  }));
};