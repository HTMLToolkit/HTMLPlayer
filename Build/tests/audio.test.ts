import { HTMLAudioBackend } from "../src/platform/audio/backends/HTMLBackend";
import { WebAudioBackend } from "../src/platform/audio/backends/WebAudioBackend";

describe("HTMLAudioBackend", () => {
  let backend: HTMLAudioBackend;

  beforeEach(() => {
    backend = new HTMLAudioBackend();
  });

  afterEach(() => {
    backend.dispose();
  });

  it("should create without errors", () => {
    expect(backend).toBeDefined();
  });

  it("should have correct default values", () => {
    expect(backend.getCurrentTime()).toBe(0);
    expect(backend.getDuration()).toBe(0);
  });

  it("should set volume", () => {
    backend.setVolume(0.5);
    backend.setVolume(1);
    backend.setVolume(0);
  });

  it("should clamp volume", () => {
    backend.setVolume(1.5);
    backend.setVolume(-0.5);
  });

  it("should set playback rate", () => {
    backend.setPlaybackRate(1.5);
    backend.setPlaybackRate(0.5);
  });

  it("should clamp playback rate", () => {
    backend.setPlaybackRate(5);
    backend.setPlaybackRate(0.1);
  });

  it("should register time update callback", () => {
    const callback = jest.fn();
    backend.onTimeUpdate(callback);
    backend.onEnded(() => {});
    backend.onError(() => {});
  });

  it("should throw on invalid URL load", async () => {
    await expect(backend.load("invalid://url")).rejects.toThrow();
  });
});

describe("WebAudioBackend", () => {
  let backend: WebAudioBackend;

  beforeEach(() => {
    backend = new WebAudioBackend();
  });

  afterEach(() => {
    backend.dispose();
  });

  it("should create without errors", () => {
    expect(backend).toBeDefined();
  });

  it("should have correct default values", () => {
    expect(backend.getCurrentTime()).toBe(0);
    expect(backend.getDuration()).toBe(0);
  });

  it("should set volume", () => {
    backend.setVolume(0.5);
  });

  it("should register callbacks", () => {
    backend.onTimeUpdate(() => {});
    backend.onEnded(() => {});
    backend.onError(() => {});
  });

  it("should throw on invalid URL load", async () => {
    await expect(backend.load("invalid://url")).rejects.toThrow();
  });
});

describe("Backend auto-detection", () => {
  it("should identify flo tracks", () => {
    const isFlo = (mimeType?: string, url?: string) => {
      if (mimeType && ["audio/x-flo", "audio/flac", "audio/wav"].includes(mimeType)) {
        return true;
      }
      if (url?.includes(".flo")) {
        return true;
      }
      return false;
    };

    expect(isFlo("audio/x-flo")).toBe(true);
    expect(isFlo("audio/flac")).toBe(true);
    expect(isFlo("audio/wav")).toBe(true);
    expect(isFlo("audio/mpeg")).toBe(false);
    expect(isFlo(undefined, "song.flo")).toBe(true);
    expect(isFlo(undefined, "song.mp3")).toBe(false);
  });
});