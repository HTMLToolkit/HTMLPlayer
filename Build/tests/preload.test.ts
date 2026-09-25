import { PreloadManager } from "../src/platform/audio/preloader";
import { KomorebiEngine } from "../src/core/engine/engine";
import type {
  IAudioBackend,
  IAudioEngineConfig,
} from "../src/core/engine/engine";
import type { Track } from "../src/core/engine/types";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

const createTrack = (id: string): Track => ({
  id,
  title: `Track ${id}`,
  artist: "Artist",
  album: "Album",
  duration: 180,
  url: `https://media.example/${id}.flac`,
});

function blobResponse(bytes?: number): Blob {
  return new Blob([new Uint8Array(bytes ?? 0)], { type: "audio/flac" });
}

describe("PreloadManager", () => {
  let originalFetch: typeof fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    globalThis.fetch = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ ok: true, blob: () => Promise.resolve(blobResponse()) }),
      ) as unknown as typeof fetch;

    URL.createObjectURL = jest.fn((blob: Blob) => `blob:${blob.size}`) as never;
    URL.revokeObjectURL = jest.fn() as never;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    jest.restoreAllMocks();
  });

  it("fetches and caches a blob url for a track", async () => {
    const manager = new PreloadManager();
    const url = await manager.preload(createTrack("a"));

    expect(url).toBe("blob:0");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://media.example/a.flac",
    );
    expect(manager.isLoaded("a")).toBe(true);
    expect(manager.getUrl("a")).toBe("blob:0");
    expect(manager.getCacheSize()).toBe(1);
    expect(manager.getLoadingCount()).toBe(0);
  });

  it("serves the cached url without refetching", async () => {
    const manager = new PreloadManager();
    const track = createTrack("a");

    const first = await manager.preload(track);
    const second = await manager.preload(track);

    expect(second).toBe(first);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent loads for the same track", async () => {
    let release!: (value: Blob) => void;
    globalThis.fetch = jest.fn(
      () =>
        new Promise<{ ok: boolean; blob: () => Promise<Blob> }>((resolve) => {
          release = () => resolve({ ok: true, blob: () => Promise.resolve(blobResponse()) });
        }),
    ) as unknown as typeof fetch;

    const manager = new PreloadManager();
    const track = createTrack("a");

    const first = manager.preload(track);
    const second = manager.preload(track);
    expect(manager.isLoading("a")).toBe(true);

    release(blobResponse());
    const [urlOne, urlTwo] = await Promise.all([first, second]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(urlTwo).toBe(urlOne);
    expect(manager.isLoading("a")).toBe(false);
  });

  it("expires cache entries past the ttl", async () => {
    const manager = new PreloadManager({ ttl: 10_000 });
    await manager.preload(createTrack("a"));

    const realNow = Date.now;
    const spy = jest.spyOn(Date, "now").mockReturnValue(realNow() + 10_001);

    try {
      expect(manager.isLoaded("a")).toBe(false);
      expect(manager.getUrl("a")).toBeNull();
      expect(manager.getCacheSize()).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("preloads the next tracks and wraps around the playlist", async () => {
    const manager = new PreloadManager({ preloadCount: 2 });
    const tracks = ["a", "b", "c", "d"].map(createTrack);

    manager.preloadNext(tracks, 0);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.isLoaded("b")).toBe(true);
    expect(manager.isLoaded("c")).toBe(true);
    expect(manager.isLoaded("a")).toBe(false);

    manager.preloadNext(tracks, 3);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.isLoaded("a")).toBe(true);
    expect(manager.isLoaded("b")).toBe(true);
  });

  it("evicts the oldest entry when the cache exceeds maxCacheSize", async () => {
    const manager = new PreloadManager({ maxCacheSize: 2 });
    await manager.preload(createTrack("a"));
    await manager.preload(createTrack("b"));
    await manager.preload(createTrack("c"));

    expect(manager.getCacheSize()).toBe(2);
    expect(manager.isLoaded("a")).toBe(false);
    expect(manager.isLoaded("b")).toBe(true);
    expect(manager.isLoaded("c")).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
  });

  it("evictAll clears and revokes every cached entry", async () => {
    const manager = new PreloadManager();
    await manager.preload(createTrack("a"));
    await manager.preload(createTrack("b"));
    expect(manager.getCacheSize()).toBe(2);

    manager.evictAll();

    expect(manager.getCacheSize()).toBe(0);
    expect(manager.isLoaded("a")).toBe(false);
    expect(manager.isLoaded("b")).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("propagates fetch failures without caching anything", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error("network down")),
    ) as unknown as typeof fetch;

    const manager = new PreloadManager();
    await expect(manager.preload(createTrack("a"))).rejects.toThrow(
      "network down",
    );
    expect(manager.isLoaded("a")).toBe(false);
    expect(manager.getCacheSize()).toBe(0);
  });
});

function createMockBackend(): IAudioBackend {
  return {
    load: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    stop: jest.fn(),
    seek: jest.fn(),
    setVolume: jest.fn(),
    setPlaybackRate: jest.fn(),
    setPitch: jest.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 180,
    getAnalyser: () => null,
    onTimeUpdate: jest.fn(),
    offTimeUpdate: jest.fn(),
    onEnded: jest.fn(),
    offEnded: jest.fn(),
    onError: jest.fn(),
    offError: jest.fn(),
    dispose: jest.fn(),
  };
}

describe("engine preload wiring", () => {
  let backend: IAudioBackend;
  let originalFetch: typeof fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;

  beforeEach(() => {
    backend = createMockBackend();
    originalFetch = globalThis.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, blob: () => Promise.resolve(blobResponse()) }),
    ) as unknown as typeof fetch;
    URL.createObjectURL = jest.fn(() => "blob:0") as never;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    (backend.dispose as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  it("resolves the cached preload url before handing the track to the backend", async () => {
    const manager = new PreloadManager();
    const track = createTrack("a");
    await manager.preload(track);

    const engine = new KomorebiEngine(backend, {
      crossfade: { enabled: false, duration: 0, shape: "none" },
      gapless: { enabled: false },
      smartShuffle: false,
      preloadManager: manager,
    } as Partial<IAudioEngineConfig>);

    try {
      await engine.load(track);
      expect(backend.load).toHaveBeenCalledTimes(1);
      expect(backend.load).toHaveBeenCalledWith(
        "blob:0",
        expect.objectContaining({ id: "a", url: "blob:0" }),
      );
    } finally {
      engine.dispose();
    }
  });

  it("falls back to the original url when nothing was preloaded", async () => {
    const manager = new PreloadManager();
    const track = createTrack("a");

    const engine = new KomorebiEngine(backend, {
      crossfade: { enabled: false, duration: 0, shape: "none" },
      gapless: { enabled: false },
      smartShuffle: false,
      preloadManager: manager,
    } as Partial<IAudioEngineConfig>);

    try {
      await engine.load(track);
      expect(backend.load).toHaveBeenCalledWith(track.url, track);
    } finally {
      engine.dispose();
    }
  });
});