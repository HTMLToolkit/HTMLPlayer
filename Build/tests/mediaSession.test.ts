import { MediaSessionIntegration } from "../src/platform/integrations/mediaSession";
import type { MediaActionHandlers } from "../src/platform/integrations/mediaSession";
import type { Track } from "../src/core/engine/types";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

interface StoredAction {
  handler: (details?: { seekTime?: number }) => void;
}

interface FakeMediaSession {
  metadata: MediaMetadata | null;
  setActionHandler: jest.Mock;
  setPositionState: jest.Mock;
  setPlaybackState: jest.Mock;
}

const createTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "track-1",
  title: "Song Title",
  artist: "Artist Name",
  album: "Album Name",
  duration: 180,
  url: "blob:audio",
  ...overrides,
});

class FakeMediaMetadata {
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly artwork: unknown[];

  constructor(init: MediaMetadataInit) {
    this.title = init.title ?? "";
    this.artist = init.artist ?? "";
    this.album = init.album ?? "";
    this.artwork = init.artwork ?? [];
  }
}

describe("MediaSessionIntegration", () => {
  let session: FakeMediaSession;
  let actions: Map<string, StoredAction>;
  let integration: MediaSessionIntegration;
  let originalMediaSession: PropertyDescriptor | undefined;
  let originalMediaMetadata: PropertyDescriptor | undefined;

  beforeEach(() => {
    actions = new Map();
    session = {
      metadata: null,
      setActionHandler: jest.fn((action: string, handler: unknown) => {
        if (handler === null) {
          actions.delete(action);
        } else {
          actions.set(action, { handler: handler as StoredAction["handler"] });
        }
      }),
      setPositionState: jest.fn(),
      setPlaybackState: jest.fn(),
    };

    originalMediaSession = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaSession",
    );
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: session,
    });

    originalMediaMetadata = Object.getOwnPropertyDescriptor(
      globalThis,
      "MediaMetadata",
    );
    Object.defineProperty(globalThis, "MediaMetadata", {
      configurable: true,
      writable: true,
      value: FakeMediaMetadata,
    });

    integration = new MediaSessionIntegration();
  });

  afterEach(() => {
    integration.dispose();
    if (originalMediaSession) {
      Object.defineProperty(navigator, "mediaSession", originalMediaSession);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).mediaSession;
    }
    if (originalMediaMetadata) {
      Object.defineProperty(globalThis, "MediaMetadata", originalMediaMetadata);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).MediaMetadata;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).fetch;
  });

  it("registers the standard action handlers on initialize", async () => {
    await integration.initialize();

    for (const action of [
      "play",
      "pause",
      "previoustrack",
      "nexttrack",
      "seekto",
      "stop",
    ]) {
      expect(session.setActionHandler).toHaveBeenCalledWith(
        action,
        expect.any(Function),
      );
    }
    expect(integration.isAvailable()).toBe(true);
  });

  it("stays unavailable when the platform lacks Media Session", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).mediaSession;
    session.setActionHandler.mockClear();

    await integration.initialize();

    expect(session.setActionHandler).not.toHaveBeenCalled();
    expect(integration.isAvailable()).toBe(false);
  });

  it("dispatches media button presses to the registered handlers", async () => {
    const handlers: MediaActionHandlers = {
      play: jest.fn(),
      pause: jest.fn(),
      next: jest.fn(),
      previous: jest.fn(),
      stop: jest.fn(),
      seek: jest.fn(),
    };
    integration.setActionHandlers(handlers);
    await integration.initialize();

    actions.get("play")!.handler();
    actions.get("pause")!.handler();
    actions.get("nexttrack")!.handler();
    actions.get("previoustrack")!.handler();
    actions.get("stop")!.handler();
    actions.get("seekto")!.handler({ seekTime: 42 });
    actions.get("seekto")!.handler({}); 

    expect(handlers.play).toHaveBeenCalledTimes(1);
    expect(handlers.pause).toHaveBeenCalledTimes(1);
    expect(handlers.next).toHaveBeenCalledTimes(1);
    expect(handlers.previous).toHaveBeenCalledTimes(1);
    expect(handlers.stop).toHaveBeenCalledTimes(1);
    expect(handlers.seek).toHaveBeenCalledWith(42);
    expect(handlers.seek).toHaveBeenCalledTimes(1);
  });

  it("publishes track metadata plus artwork from a fetched blob", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ blob: () => Promise.resolve(new Blob([], { type: "image/png" })) }),
    ) as unknown as typeof fetch;

    await integration.initialize();
    await integration.updateMetadata(
      createTrack({ albumArt: "https://art.example/cover.png" }),
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://art.example/cover.png",
    );
    const metadata = session.metadata as FakeMediaMetadata;
    expect(metadata.title).toBe("Song Title");
    expect(metadata.artist).toBe("Artist Name");
    expect(metadata.album).toBe("Album Name");
    expect(metadata.artwork).toEqual([
      {
        src: "https://art.example/cover.png",
        sizes: "512x512",
        type: "image/png",
      },
    ]);
  });

  it("publishes metadata without artwork when the art fetch fails", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error("art unreachable")),
    ) as unknown as typeof fetch;

    await integration.initialize();
    await integration.updateMetadata(
      createTrack({ albumArt: "https://art.example/cover.png" }),
    );

    const metadata = session.metadata as FakeMediaMetadata;
    expect(metadata.title).toBe("Song Title");
    expect(metadata.artwork).toEqual([]);
  });

  it("omits artwork when the track has no album art", async () => {
    await integration.initialize();
    await integration.updateMetadata(createTrack());

    const metadata = session.metadata as FakeMediaMetadata;
    expect(metadata.title).toBe("Song Title");
    expect(metadata.artwork).toEqual([]);
  });

  it("clears metadata for a null track", async () => {
    await integration.initialize();
    await integration.updateMetadata(createTrack());
    await integration.updateMetadata(null);

    expect(session.metadata).toBeNull();
  });

  it("writes playback state and tolerates an unsupported setter", async () => {
    await integration.initialize();

    integration.setPlaybackState("playing");
    expect(session.setPlaybackState).toHaveBeenCalledWith("playing");

    session.setPlaybackState = undefined as unknown as jest.Mock;
    expect(() => integration.setPlaybackState("paused")).not.toThrow();
  });

  it("clamps position and rejects invalid durations", async () => {
    await integration.initialize();

    integration.setPositionState(100, 150, 1.5);
    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 100,
      position: 100,
      playbackRate: 1.5,
    });

    integration.setPositionState(100, -5);
    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 100,
      position: 0,
      playbackRate: 1,
    });

    integration.setPositionState(0, 10);
    integration.setPositionState(Number.NaN, 10);
    expect(session.setPositionState).toHaveBeenCalledTimes(2);
  });

  it("clears the registered handlers on dispose", async () => {
    await integration.initialize();
    const before = new Set(actions.keys());

    integration.dispose();

    for (const action of before) {
      expect(session.setActionHandler).toHaveBeenCalledWith(action, null);
    }
    expect(actions.size).toBe(0);
    expect(integration.isAvailable()).toBe(false);
  });
});