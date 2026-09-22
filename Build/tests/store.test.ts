import { KomorebiEvents } from "../src/core/engine/events";
import type {
  EngineEventMap,
  EngineState,
  Track,
} from "../src/core/engine/types";
import type { KomorebiEngine } from "../src/core/engine/engine";
import {
  EMPTY_CURSOR,
  EMPTY_QUEUE_STATE,
  useKomorebiStore,
  selectQueueCursor,
  selectQueueTracks,
  selectCurrentTrack,
  selectCurrentPlaylist,
  selectIsPlaying,
  selectCurrentTime,
  selectDuration,
  selectVolume,
} from "../src/store";

function makeTrack(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artist: "Artist",
    album: "Album",
    duration: 180,
    url: `file:///${id}.mp3`,
  };
}

function makeState(overrides: Partial<EngineState>): EngineState {
  return {
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
    ...overrides,
  };
}

class FakeEngine {
  private events = new KomorebiEvents();
  snapshot: EngineState = makeState({});

  setSnapshot(next: EngineState): void {
    this.snapshot = next;
    this.events.emit("statechange", {
      oldState: "idle",
      newState: next.state,
    });
  }

  emitTimeUpdate(currentTime: number, duration: number): void {
    this.events.emit("timeupdate", { currentTime, duration });
  }

  getState(): EngineState {
    return this.snapshot;
  }

  on<E extends keyof EngineEventMap>(
    event: E,
    callback: (data: EngineEventMap[E]) => void,
  ): void {
    this.events.on(event, callback);
  }

  off<E extends keyof EngineEventMap>(
    event: E,
    callback: (data: EngineEventMap[E]) => void,
  ): void {
    this.events.off(event, callback);
  }
}

const asEngine = (fake: FakeEngine): KomorebiEngine =>
  fake as unknown as KomorebiEngine;

function resetStore(): void {
  useKomorebiStore.setState({
    snapshot: null,
    songs: [],
    ready: false,
    loading: false,
    error: null,
    currentTime: 0,
    duration: 0,
  });
}

describe("useKomorebiStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("selectors with no snapshot", () => {
    it("selectQueueCursor returns the empty cursor", () => {
      const store = useKomorebiStore.getState();
      expect(selectQueueCursor(store)).toEqual(EMPTY_CURSOR);
    });

    it("selectCurrentTrack returns null for empty cursor", () => {
      const store = useKomorebiStore.getState();
      expect(selectCurrentTrack(store)).toBeNull();
    });

    it("selectQueueTracks returns an empty array", () => {
      const store = useKomorebiStore.getState();
      expect(selectQueueTracks(store)).toEqual([]);
    });

    it("selectVolume falls back to 1", () => {
      const store = useKomorebiStore.getState();
      expect(selectVolume(store)).toBe(1);
    });
  });

  describe("selectCurrentTrack", () => {
    it("resolves the track at the active cursor index", () => {
      useKomorebiStore.setState({
        snapshot: makeState({
          state: "playing",
          currentTrack: makeTrack("b"),
          queue: {
            tracks: [makeTrack("a"), makeTrack("b")],
            cursor: { kind: "active", index: 1 },
            shuffled: false,
            shuffleOrder: [],
          },
        }),
      });
      const store = useKomorebiStore.getState();
      expect(selectCurrentTrack(store)?.id).toBe("b");
      expect(selectCurrentPlaylist(store)).toBeNull();
      expect(selectIsPlaying(store)).toBe(true);
    });

    it("returns null when the active index is missing a track", () => {
      useKomorebiStore.setState({
        snapshot: makeState({
          queue: {
            tracks: [],
            cursor: { kind: "active", index: 0 },
            shuffled: false,
            shuffleOrder: [],
          },
        }),
      });
      const store = useKomorebiStore.getState();
      expect(selectCurrentTrack(store)).toBeNull();
    });
  });

  describe("attachEngine", () => {
    it("loads the initial snapshot and derives loading", () => {
      const fake = new FakeEngine();
      fake.snapshot = makeState({ state: "loading" });

      const detach = useKomorebiStore.getState().attachEngine(asEngine(fake));
      const store = useKomorebiStore.getState();

      expect(store.snapshot?.state).toBe("loading");
      expect(store.loading).toBe(true);
      expect(store.currentTime).toBe(0);

      detach();
    });

    it("updates loading on statechange", () => {
      const fake = new FakeEngine();
      const detach = useKomorebiStore.getState().attachEngine(asEngine(fake));

      fake.setSnapshot(makeState({ state: "playing" }));

      const store = useKomorebiStore.getState();
      expect(store.loading).toBe(false);
      expect(store.snapshot?.state).toBe("playing");

      fake.setSnapshot(makeState({ state: "loading" }));
      expect(useKomorebiStore.getState().loading).toBe(true);

      detach();
    });

    it("updates currentTime and duration on timeupdate", () => {
      const fake = new FakeEngine();
      const detach = useKomorebiStore.getState().attachEngine(asEngine(fake));

      fake.emitTimeUpdate(42, 180);

      const store = useKomorebiStore.getState();
      expect(store.currentTime).toBe(42);
      expect(store.duration).toBe(180);

      detach();
    });

    it("stops updating after detach", () => {
      const fake = new FakeEngine();
      const detach = useKomorebiStore.getState().attachEngine(asEngine(fake));

      detach();
      fake.setSnapshot(makeState({ state: "error", error: { code: "E", message: "boom" } }));

      const store = useKomorebiStore.getState();
      expect(store.snapshot?.state).toBe("idle");
    });
  });
});