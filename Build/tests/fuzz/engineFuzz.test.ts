import type {
  IAudioBackend,
} from "../../src/platform/audio";
import {
  KomorebiEngine,
  type IAudioEngineConfig,
} from "../../src/core/engine/engine";
import type {
  EngineState,
  PlayerState,
  Playlist,
  Track,
} from "../../src/core/engine/types";
import { createMockTrack, mulberry32, randomInt } from "../helpers";

/**
 * Controllable backend for the engine fuzz. All failures are drawn from the
 * seeded PRNG, so a given seed reproduces the exact same backend behaviour.
 */
class FuzzBackend implements IAudioBackend {
  load: jest.Mock<Promise<void>, [string]>;
  play: jest.Mock<Promise<void>, []>;
  pausedMode: boolean;
  private loaded = false;
  private internalTime = 0;
  private readonly rand: () => number;
  private readonly loadFailRate: number;
  private readonly playFailRate: number;

  private timeHandler: ((time: number) => void) | null = null;
  private endedHandler: (() => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  constructor(
    rand: () => number,
    loadFailRate = 0.35,
    playFailRate = 0.25,
  ) {
    this.rand = rand;
    this.loadFailRate = loadFailRate;
    this.playFailRate = playFailRate;
    this.pausedMode = false;

    this.load = jest.fn((_url: string) => {
      return new Promise<void>((resolve, reject) => {
        if (this.rand() < this.loadFailRate) {
          reject(new Error("fuzz: backend load failed"));
          return;
        }
        this.loaded = true;
        this.internalTime = 0;
        resolve();
      });
    });

    this.play = jest.fn(() => {
      return new Promise<void>((resolve, reject) => {
        if (this.rand() < this.playFailRate) {
          reject(new Error("fuzz: backend play failed"));
          return;
        }
        this.pausedMode = false;
        resolve();
      });
    });
  }

  pause(): void {
    this.pausedMode = true;
  }

  stop(): void {
    this.loaded = false;
    this.internalTime = 0;
    this.pausedMode = false;
  }

  seek(time: number): void {
    this.internalTime = time;
  }

  setVolume(_volume: number): void {}
  setPlaybackRate(_rate: number): void {}

  getCurrentTime(): number {
    return this.internalTime;
  }

  getDuration(): number {
    return 600;
  }

  onTimeUpdate(callback: (time: number) => void): void {
    this.timeHandler = callback;
  }

  offTimeUpdate(_callback: (time: number) => void): void {
    this.timeHandler = null;
  }

  onEnded(callback: () => void): void {
    this.endedHandler = callback;
  }

  offEnded(_callback: () => void): void {
    this.endedHandler = null;
  }

  onError(callback: (error: Error) => void): void {
    this.errorHandler = callback;
  }

  offError(_callback: (error: Error) => void): void {
    this.errorHandler = null;
  }

  dispose(): void {}

  fireTimeUpdate(time: number): void {
    this.internalTime = time;
    this.timeHandler?.(time);
  }

  fireEnded(): void {
    this.endedHandler?.();
  }

  fireError(message: string): void {
    this.errorHandler?.(new Error(`fuzz backend error: ${message}`));
  }
}

interface FuzzState {
  engine: KomorebiEngine;
  backend: FuzzBackend;
  rand: () => number;
  violations: string[];
  applied: string[];
}

const VALID_STATES: readonly PlayerState[] = [
  "idle",
  "loading",
  "ready",
  "playing",
  "paused",
  "transitioning",
  "error",
];

function recordViolation(state: FuzzState, step: number, message: string): void {
  state.violations.push(
    `step ${step}: ${message}\nrecent history:\n${state.applied.slice(-12).join("\n")}`,
  );
}

function assertEngineInvariants(state: FuzzState, step: number): void {
  const snapshot: EngineState = state.engine.getState();
  if (!VALID_STATES.includes(snapshot.state)) {
    recordViolation(state, step, `unknown engine state: ${snapshot.state}`);
  }

  if (snapshot.error !== null &&
      snapshot.state !== "error" &&
      snapshot.state !== "loading") {
    recordViolation(
      state,
      step,
      `stale error (${snapshot.error.code}) while state is ${snapshot.state}`,
    );
  }

  if (!Number.isFinite(snapshot.currentTime) || snapshot.currentTime < 0) {
    recordViolation(
      state,
      step,
      `non-finite or negative currentTime: ${snapshot.currentTime}`,
    );
  }

  if (!Number.isFinite(snapshot.duration) || snapshot.duration < 0) {
    recordViolation(
      state,
      step,
      `non-finite or negative duration: ${snapshot.duration}`,
    );
  }

  if (snapshot.settings.volume < 0 || snapshot.settings.volume > 1) {
    recordViolation(state, step, `volume out of range: ${snapshot.settings.volume}`);
  }
}

function drawOp(
  rand: () => number,
  tracks: Track[],
): { name: string; track?: Track; apply: (state: FuzzState) => Promise<void> } {
  const roll = rand();
  const pick = (): Track => {
    const idx = randomInt(rand, 0, tracks.length - 1);
    const track = tracks[idx];
    if (track === undefined) {
      throw new Error("fuzz track pool empty");
    }
    return track;
  };

  if (roll < 0.18) {
    const track = pick();
    return {
      name: "load",
      track,
      apply: async (s) => {
        await s.engine.load(track);
      },
    };
  }

  if (roll < 0.42) {
    return {
      name: "play",
      apply: async (s) => {
        await s.engine.play();
      },
    };
  }

  if (roll < 0.52) {
    return {
      name: "pause",
      apply: async (s) => {
        s.engine.pause();
      },
    };
  }

  if (roll < 0.62) {
    return {
      name: "stop",
      apply: async (s) => {
        s.engine.stop();
      },
    };
  }

  if (roll < 0.72) {
    return {
      name: "seek",
      apply: async (s) => {
        s.engine.seek(randomInt(rand, 0, 300));
      },
    };
  }

  if (roll < 0.84) {
    return {
      name: "next",
      apply: async (s) => {
        await s.engine.next();
      },
    };
  }

  if (roll < 0.9) {
    return {
      name: "previous",
      apply: async (s) => {
        await s.engine.previous();
      },
    };
  }

  if (roll < 0.95) {
    return {
      name: "backendError",
      apply: async (s) => {
        s.backend.fireError(`injected-${randomInt(rand, 1, 999)}`);
      },
    };
  }

  return {
    name: "backendEnded",
    apply: async (s) => {
      s.backend.fireEnded();
    },
  };
}

function flushMicrotasks(times = 8): Promise<void> {
  let chain: Promise<void> = Promise.resolve();
  for (let i = 0; i < times; i++) {
    chain = chain.then(() => Promise.resolve());
  }
  return chain;
}

function createFuzzEngine(backend: FuzzBackend): KomorebiEngine {
  const config: Partial<IAudioEngineConfig> = {
    crossfade: { enabled: false, duration: 0, shape: "none" },
    gapless: { enabled: false },
    smartShuffle: false,
  };
  return new KomorebiEngine(backend, config);
}

describe("KomorebiEngine model fuzz: no rejection, no invalid transition, no invariant break", () => {
  const seeds = [101, 202, 303, 404, 505];
  const stepsPerSeed = 400;
  const trackCount = 5;

  for (const seed of seeds) {
    it(`survives ${stepsPerSeed} random ops + failing backend (seed ${seed})`, async () => {
      const rand = mulberry32(seed);
      const tracks = Array.from({ length: trackCount }, (_, i) =>
        createMockTrack(String(i + 1)),
      );
      const backend = new FuzzBackend(rand);
      const engine = createFuzzEngine(backend);
      const state: FuzzState = {
        engine,
        backend,
        rand,
        violations: [],
        applied: [],
      };

      const playlist: Playlist = {
        id: "fuzz-playlist",
        name: "Fuzz",
        songs: tracks,
      };
      engine.setPlaylist(playlist);

      try {
        for (let step = 1; step <= stepsPerSeed; step++) {
          const op = drawOp(rand, tracks);
          try {
            await op.apply(state);
          } catch (error) {
            recordViolation(
              state,
              step,
              `public engine call "${op.name}" threw or rejected: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
          await flushMicrotasks();
          try {
            assertEngineInvariants(state, step);
          } catch (error) {
            recordViolation(
              state,
              step,
              error instanceof Error ? error.message : String(error),
            );
          }
          state.applied.push(op.name);
        }
      } finally {
        engine.dispose();
      }

      expect(state.violations).toEqual([]);
    });
  }
});