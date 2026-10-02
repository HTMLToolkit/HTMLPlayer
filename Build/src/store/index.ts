import { create } from "zustand";
import type { KomorebiEngine } from "../core/engine/engine";
import {
  clampBand,
  createInitialEqualizerState,
  EQUALIZER_PRESETS,
  type EqualizerBand,
  type EqualizerPreset,
  type EqualizerState,
} from "../platform/audio/equalizer";
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

function matchPreset(bands: EqualizerBand[]): string | null {
  for (const preset of EQUALIZER_PRESETS) {
    const matches = preset.bands.every((band, index) => {
      const current = bands[index];
      return (
        current !== undefined &&
        current.type === band.type &&
        Math.abs(current.gainDb - band.gainDb) < 0.001 &&
        Math.abs(current.frequency - band.frequency) < 0.001
      );
    });
    if (matches) return preset.name;
  }
  return null;
}

export { createInitialEqualizerState };
export type { EqualizerState };

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
  equalizer: EqualizerState;
  setEqualizerEnabled: (enabled: boolean) => void;
  setEqualizerBands: (bands: EqualizerBand[]) => void;
  patchEqualizerBand: (index: number, patch: Partial<EqualizerBand>) => void;
  applyEqualizerPreset: (preset: EqualizerPreset) => void;
  resetEqualizer: () => void;
  hydrateEqualizer: (state: EqualizerState) => void;
}

export const useKomorebiStore = create<KomorebiStoreState>()((set) => ({
  snapshot: null,
  songs: [],
  ready: false,
  loading: false,
  error: null,
  currentTime: 0,
  duration: 0,
  equalizer: createInitialEqualizerState(),

  setEqualizerEnabled: (enabled) =>
    set((state) => ({
      equalizer: { ...state.equalizer, enabled },
    })),

  setEqualizerBands: (bands) =>
    set(() => {
      const clamped = bands.map(clampBand);
      return {
        equalizer: {
          enabled: true,
          bands: clamped,
          presetName: matchPreset(clamped),
        },
      };
    }),

  patchEqualizerBand: (index, patch) =>
    set((state) => {
      const current = state.equalizer.bands[index];
      if (!current) return state;

      const bands = state.equalizer.bands.map((band, i) =>
        i === index ? clampBand({ ...band, ...patch }) : band,
      );

      return {
        equalizer: {
          ...state.equalizer,
          enabled: true,
          bands,
          presetName: matchPreset(bands),
        },
      };
    }),

  applyEqualizerPreset: (preset) =>
    set(() => ({
      equalizer: {
        enabled: true,
        bands: preset.bands.map(clampBand),
        presetName: preset.name,
      },
    })),

  resetEqualizer: () => set({ equalizer: createInitialEqualizerState() }),

  hydrateEqualizer: (next) =>
    set(() => ({
      equalizer: {
        enabled: next.enabled,
        presetName: next.presetName,
        bands: next.bands.map(clampBand),
      },
    })),

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

export const selectTempo = (store: KomorebiStoreState): number =>
  store.snapshot?.settings.tempo ?? 1;

export const selectPitch = (store: KomorebiStoreState): number =>
  store.snapshot?.settings.pitch ?? 0;

export const selectCrossfade = (store: KomorebiStoreState): number =>
  store.snapshot?.settings.crossfade ?? 0;

export const selectGapless = (store: KomorebiStoreState): boolean =>
  store.snapshot?.settings.gaplessPlayback ?? true;

export const selectSmartShuffle = (store: KomorebiStoreState): boolean =>
  store.snapshot?.settings.smartShuffle ?? false;

export const selectAutoPlayNext = (store: KomorebiStoreState): boolean =>
  store.snapshot?.settings.autoPlayNext ?? true;

export const selectShuffle = (store: KomorebiStoreState): boolean =>
  store.snapshot?.queue.shuffled ?? false;

export const selectRepeat = (
  store: KomorebiStoreState,
): "off" | "one" | "all" => store.snapshot?.settings.repeat ?? "off";

export const selectEqualizer = (store: KomorebiStoreState): EqualizerState =>
  store.equalizer;

export const selectEqualizerEnabled = (store: KomorebiStoreState): boolean =>
  store.equalizer.enabled;

export const selectEqualizerBands = (
  store: KomorebiStoreState,
): EqualizerBand[] => store.equalizer.bands;

export const selectEqualizerPresetName = (
  store: KomorebiStoreState,
): string | null => store.equalizer.presetName;
