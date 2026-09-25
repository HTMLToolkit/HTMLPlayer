import {
  BackendRouter,
  chooseBackendKind,
} from "../src/platform/audio/backends/BackendRouter";
import type { IAudioBackend } from "../src/platform/audio";
import type { Track } from "../src/core/engine/types";

class StubBackend implements IAudioBackend {
  calls: Array<{ url: string; track: Track | undefined }> = [];
  volume = 1;
  rate = 1;
  pitch: number | undefined;
  failLoad = false;
  private timeUpdateCallbacks = new Set<(time: number) => void>();
  private endedCallbacks = new Set<() => void>();
  private errorCallbacks = new Set<(error: Error) => void>();
  private disposed = false;

  async load(url: string, track?: Track): Promise<void> {
    this.calls.push({ url, track });
    if (this.failLoad) {
      throw new Error(`stub load failed: ${url}`);
    }
  }

  async play(): Promise<void> {}
  pause(): void {}
  stop(): void {}
  seek(_time: number): void {}

  setVolume(volume: number): void {
    this.volume = volume;
  }

  setPlaybackRate(rate: number): void {
    this.rate = rate;
  }

  setPitch(semitones: number): void {
    this.pitch = semitones;
  }

  getCurrentTime(): number {
    return 0;
  }

  getDuration(): number {
    return 0;
  }

  getAnalyser(): AnalyserNode | null {
    return null;
  }

  onTimeUpdate(callback: (time: number) => void): void {
    this.timeUpdateCallbacks.add(callback);
  }

  offTimeUpdate(callback: (time: number) => void): void {
    this.timeUpdateCallbacks.delete(callback);
  }

  onEnded(callback: () => void): void {
    this.endedCallbacks.add(callback);
  }

  offEnded(callback: () => void): void {
    this.endedCallbacks.delete(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback);
  }

  offError(callback: (error: Error) => void): void {
    this.errorCallbacks.delete(callback);
  }

  dispose(): void {
    this.disposed = true;
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  emitTime(time: number): void {
    this.timeUpdateCallbacks.forEach((cb) => cb(time));
  }

  emitEnded(): void {
    this.endedCallbacks.forEach((cb) => cb());
  }

  emitError(error: Error): void {
    this.errorCallbacks.forEach((cb) => cb(error));
  }
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    title: "Track One",
    artist: "Artist",
    album: "Album",
    duration: 180,
    url: "blob:mock-url",
    ...overrides,
  };
}

describe("chooseBackendKind", () => {
  it("routes flo tracks by mimeType", () => {
    expect(chooseBackendKind(makeTrack({ mimeType: "audio/x-flo" }))).toBe(
      "flo",
    );
    expect(chooseBackendKind(makeTrack({ mimeType: "audio/mpeg" }))).toBe(
      "html",
    );
  });

  it("routes flac and wav straight to the decoder backend", () => {
    expect(chooseBackendKind(makeTrack({ mimeType: "audio/flac" }))).toBe(
      "webaudio",
    );
    expect(chooseBackendKind(makeTrack({ mimeType: "audio/wav" }))).toBe(
      "webaudio",
    );
  });

  it("falls back to the url when no track is given", () => {
    expect(chooseBackendKind(undefined, "http://x/y.flo")).toBe("flo");
    expect(chooseBackendKind(undefined, "http://x/y.mp3")).toBe("html");
    expect(chooseBackendKind(undefined, undefined)).toBe("html");
  });
});

describe("BackendRouter", () => {
  let html: StubBackend;
  let webAudio: StubBackend;
  let flo: StubBackend;
  let router: BackendRouter;

  beforeEach(() => {
    html = new StubBackend();
    webAudio = new StubBackend();
    flo = new StubBackend();
    router = new BackendRouter(undefined, { html, webAudio, flo });
  });

  afterEach(() => {
    router.dispose();
  });

  it("routes a flo track to the flo backend with url and track", async () => {
    const track = makeTrack({ mimeType: "audio/x-flo" });
    await router.load("blob:flo-url", track);

    expect(flo.calls).toHaveLength(1);
    expect(flo.calls[0]).toEqual({ url: "blob:flo-url", track });
    expect(html.calls).toHaveLength(0);
    expect(webAudio.calls).toHaveLength(0);
  });

  it("routes a regular track to the html backend", async () => {
    const track = makeTrack({ mimeType: "audio/mpeg" });
    await router.load("blob:mp3-url", track);

    expect(html.calls).toHaveLength(1);
    expect(flo.calls).toHaveLength(0);
  });

  it("routes flac straight to the Web Audio decoder", async () => {
    const track = makeTrack({ mimeType: "audio/flac" });
    await router.load("blob:flac-url", track);

    expect(html.calls).toHaveLength(0);
    expect(webAudio.calls).toHaveLength(1);
    expect(webAudio.calls[0]).toEqual({ url: "blob:flac-url", track });
    expect(flo.calls).toHaveLength(0);
  });

  it("falls back to Web Audio when the html load fails", async () => {
    html.failLoad = true;
    const track = makeTrack({ mimeType: "audio/mpeg" });
    await router.load("blob:mp3-url", track);

    expect(html.calls).toHaveLength(1);
    expect(webAudio.calls).toHaveLength(1);
    expect(webAudio.calls[0]).toEqual({ url: "blob:mp3-url", track });
  });

  it("falls back to HTML streaming when the decode path fails", async () => {
    webAudio.failLoad = true;
    const track = makeTrack({ mimeType: "audio/flac" });
    await router.load("blob:flac-url", track);

    expect(webAudio.calls).toHaveLength(1);
    expect(html.calls).toHaveLength(1);
  });

  it("rethrows the html error when Web Audio also fails", async () => {
    html.failLoad = true;
    webAudio.failLoad = true;

    await expect(
      router.load("blob:mp3-url", makeTrack({ mimeType: "audio/mpeg" })),
    ).rejects.toThrow("stub load failed: blob:mp3-url");
  });

  it("replays volume, rate, and pitch on the newly active backend", async () => {
    router.setVolume(0.4);
    router.setPlaybackRate(2);
    router.setPitch(3);

    await router.load(
      "blob:flo-url",
      makeTrack({ mimeType: "audio/x-flo" }),
    );

    expect(flo.volume).toBe(0.4);
    expect(flo.rate).toBe(2);
    expect(flo.pitch).toBe(3);
  });

  it("bridges timeupdate, ended, and error from the active backend", async () => {
    const times: number[] = [];
    const ended: boolean[] = [];
    const errors: string[] = [];

    router.onTimeUpdate((t) => times.push(t));
    router.onEnded(() => ended.push(true));
    router.onError((e) => errors.push(e.message));

    await router.load(
      "blob:flo-url",
      makeTrack({ mimeType: "audio/x-flo" }),
    );

    flo.emitTime(12.5);
    flo.emitEnded();
    flo.emitError(new Error("boom"));

    expect(times).toEqual([12.5]);
    expect(ended).toEqual([true]);
    expect(errors).toEqual(["boom"]);
  });

  it("delegates playback control to the active backend", async () => {
    await router.load(
      "blob:mp3-url",
      makeTrack({ mimeType: "audio/mpeg" }),
    );

    await router.play();
    router.pause();
    router.seek(30);

    expect(router.getCurrentTime()).toBe(0);
    expect(router.getDuration()).toBe(0);
  });

  it("returns no analyser when Web Audio is unavailable", () => {
    expect(router.getAnalyser()).toBeNull();
  });

  it("disposes every inner backend at most once", () => {
    router.dispose();
    expect(html.isDisposed()).toBe(true);
    expect(webAudio.isDisposed()).toBe(true);
    expect(flo.isDisposed()).toBe(true);
  });
});