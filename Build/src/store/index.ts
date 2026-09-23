import { create } from "zustand";
import type { KomorebiEngine } from "../core/engine/engine";
import type {
  EngineEventMap,
  EngineState,
  QueueCursor,
  QueueState,
  Track,
} from "../core/engine/types";

export const EMPTY_CURSOR: QueueCursor = { kind: "empty" };

export const EMPTY_QUEUE_STATE: QueueState = {
  tracks: [],
  cursor: EMPTY_CURSOR,
  shuffled: false,
  shuffleOrder: [],
};

export const EMPTY_ENGINE_STATE: EngineState = {
  state: "idle",
  currentTrack: null,
  currentPlaylist: null,
  queue: EMPTY_QUEUE_STATE,
  settings: {
    volume: 1,
    crossfade: 0,
    crossfadeBeforeGapless: 3000,
    autoPlayNext: true,
    tempo: 1,
    pitch: 0,
    gaplessPlayback: true,
    smartShuffle: false,
    repeat: "off",
    defaultShuffle: false,
    defaultRepeat: "off",
  },
  currentTime: 0,
  duration: 0,
  volume: 1,
  playHistory: new Map(),
  error: null,
};

/**
 * UI-side mirror of the engine. The store is the compile-time contract between
 * the engine and React: consumers select a typed slice (e.g.
 * {@link selectQueueCursor}) and the type system forces exhaustive handling of
 * every cursor kind instead of relying on a `-1` sentinel.
 */
export interface KomorebiStoreState {
  snapshot: EngineState | null;
  songs: Track[];
  ready: boolean;
  loading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  attachEngine: (engine: KomorebiEngine) => () => void;
  setSongs: (songs: Track[]) => void;
  setReady: (ready: boolean) => void;
  setError: (error: string | null) => void;
}

export const useKomorebiStore = create<KomorebiStoreState>()((set) => ({
  snapshot: null,
  songs: [],
  ready: false,
  loading: false,
  error: null,
  currentTime: 0,
  duration: 0,

  attachEngine: (engine) => {
    const refresh = (): void => {
      const snapshot = engine.getState();
      set({
        snapshot,
        loading: snapshot.state === "loading",
        error: snapshot.error?.message ?? null,
      });
    };

    const subscribe = <E extends keyof EngineEventMap>(
      event: E,
      callback: (data: EngineEventMap[E]) => void,
    ): (() => void) => {
      engine.on(event, callback);
      return () => engine.off(event, callback);
    };

    const detachHandlers = [
      subscribe("statechange", refresh),
      subscribe("trackchange", refresh),
      subscribe("queuechange", refresh),
      subscribe("settingschange", refresh),
      subscribe("volumechange", refresh),
      subscribe("durationchange", refresh),
      subscribe("error", refresh),
      subscribe("loading", refresh),
      subscribe("ready", refresh),
      subscribe("timeupdate", (data) => {
        set({ currentTime: data.currentTime, duration: data.duration });
      }),
    ];

    refresh();

    return () => {
      detachHandlers.forEach((detach) => detach());
    };
  },

  setSongs: (songs) => set({ songs }),
  setReady: (ready) => set({ ready }),
  setError: (error) => set({ error }),
}));

export const selectSnapshot = (store: KomorebiStoreState): EngineState | null =>
  store.snapshot;

export const selectSongs = (store: KomorebiStoreState): Track[] => store.songs;

export const selectIsReady = (store: KomorebiStoreState): boolean =>
  store.ready;

export const selectIsLoading = (store: KomorebiStoreState): boolean =>
  store.loading;

export const selectError = (store: KomorebiStoreState): string | null =>
  store.error;

export const selectCurrentTime = (store: KomorebiStoreState): number =>
  store.currentTime;

export const selectDuration = (store: KomorebiStoreState): number =>
  store.duration;

export const selectQueue = (store: KomorebiStoreState): QueueState =>
  store.snapshot?.queue ?? EMPTY_QUEUE_STATE;

export const selectQueueCursor = (store: KomorebiStoreState): QueueCursor =>
  store.snapshot?.queue.cursor ?? EMPTY_CURSOR;

export const selectQueueTracks = (store: KomorebiStoreState): Track[] =>
  store.snapshot?.queue.tracks ?? [];

export const selectCurrentTrack = (store: KomorebiStoreState): Track | null => {
  const cursor = selectQueueCursor(store);
  switch (cursor.kind) {
    case "empty":
      return null;
    case "active":
      return selectQueueTracks(store)[cursor.index] ?? null;
  }
};

export const selectCurrentPlaylist = (
  store: KomorebiStoreState,
): EngineState["currentPlaylist"] => store.snapshot?.currentPlaylist ?? null;

export const selectIsPlaying = (store: KomorebiStoreState): boolean =>
  store.snapshot?.state === "playing";

export const selectVolume = (store: KomorebiStoreState): number =>
  store.snapshot?.settings.volume ?? 1;

export const selectShuffle = (store: KomorebiStoreState): boolean =>
  store.snapshot?.queue.shuffled ?? false;

export const selectRepeat = (
  store: KomorebiStoreState,
): "off" | "one" | "all" => store.snapshot?.settings.repeat ?? "off";
