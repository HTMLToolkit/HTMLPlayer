import {
  BackendRouter,
  chooseBackendKind,
  crossfadePartnerKinds,
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

  it("routes any stored non-flo audio through Symphonia", () => {
    expect(chooseBackendKind(makeTrack({ hasStoredAudio: true }))).toBe(
      "symphonia",
    );
    expect(
      chooseBackendKind(makeTrack({ hasStoredAudio: true, mimeType: "audio/mpeg" })),
    ).toBe("symphonia");
    expect(
      chooseBackendKind(makeTrack({ hasStoredAudio: true, mimeType: "audio/flac" })),
    ).toBe("symphonia");
  });

  it("keeps remote (non-stored) tracks on the platform backends", () => {
    expect(chooseBackendKind(makeTrack({ mimeType: "audio/flac" }))).toBe(
      "html",
    );
    expect(chooseBackendKind(makeTrack({ mimeType: "audio/wav" }))).toBe(
      "html",
    );
  });

  it("routes a stored Opus track to html using the parsed codec", () => {
    const track = makeTrack({
      hasStoredAudio: true,
      mimeType: "audio/ogg",
      fileName: "sample3",
      encoding: { codec: "Opus", sampleRate: 48000, channels: 2 },
    });

    expect(chooseBackendKind(track)).toBe("html");
    expect(chooseBackendKind(makeTrack({ ...track, encoding: undefined }))).toBe(
      "symphonia",
    );
  });

  it("keeps a stored Vorbis track on Symphonia despite the codec hint", () => {
    const track = makeTrack({
      hasStoredAudio: true,
      mimeType: "audio/ogg",
      fileName: "sample3",
      encoding: { codec: "Vorbis I", sampleRate: 44100, channels: 2 },
    });

    expect(chooseBackendKind(track)).toBe("symphonia");
  });

  it("falls back to the url when no track is given", () => {
    expect(chooseBackendKind(undefined, "http://x/y.flo")).toBe("flo");
    expect(chooseBackendKind(undefined, "http://x/y.mp3")).toBe("html");
    expect(chooseBackendKind(undefined, undefined)).toBe("html");
  });
});

describe("crossfadePartnerKinds", () => {
  it("prefers the mapped backend, then the live backend, then html", () => {
    expect(
      crossfadePartnerKinds(
        makeTrack({ hasStoredAudio: true, mimeType: "audio/flac" }),
        "blob:flac-url",
        "html",
      ),
    ).toEqual(["symphonia", "html"]);
    expect(
      crossfadePartnerKinds(
        makeTrack({ hasStoredAudio: true, mimeType: "audio/flac" }),
        "blob:flac-url",
        "flo",
      ),
    ).toEqual(["symphonia", "flo", "html"]);
  });

  it("tries html as a fallback even when the mapped backend matches the live one", () => {
    expect(
      crossfadePartnerKinds(
        makeTrack({ hasStoredAudio: true, mimeType: "audio/mpeg" }),
        "blob:mp3-url",
        "symphonia",
      ),
    ).toEqual(["symphonia", "html"]);
  });

  it("carries an ogg track (ambiguous vorbis/opus) to html when symphonia is live", () => {
    expect(
      crossfadePartnerKinds(
        makeTrack({ hasStoredAudio: true, mimeType: "audio/ogg", title: "mix" }),
        "blob:mix-url",
        "symphonia",
      ),
    ).toEqual(["symphonia", "html"]);
  });

  it("collapses to a single kind on Safari", () => {
    withSafariUa(() => {
      expect(
        crossfadePartnerKinds(
          makeTrack({ hasStoredAudio: true, mimeType: "audio/mpeg" }),
          "blob:mp3-url",
          "html",
        ),
      ).toEqual(["html"]);
    });
  });

  it("keeps flo first for flo tracks regardless of the live backend", () => {
    expect(
      crossfadePartnerKinds(
        makeTrack({ mimeType: "audio/x-flo" }),
        "blob:flo-url",
        "symphonia",
      ),
    ).toEqual(["flo", "symphonia", "html"]);
  });
});

const SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function withSafariUa(assert: () => void): void {
  const original = navigator.userAgent;
  Object.defineProperty(navigator, "userAgent", {
    value: SAFARI_UA,
    configurable: true,
  });
  try {
    assert();
  } finally {
    Object.defineProperty(navigator, "userAgent", {
      value: original,
      configurable: true,
    });
  }
}

describe("chooseBackendKind on Safari", () => {
  it("routes stored non-flo audio through the platform html backend", () => {
    withSafariUa(() => {
      expect(
        chooseBackendKind(
          makeTrack({ hasStoredAudio: true, mimeType: "audio/mpeg" }),
        ),
      ).toBe("html");
    });
  });

  it("still routes flo tracks through the flo backend", () => {
    withSafariUa(() => {
      expect(
        chooseBackendKind(
          makeTrack({ hasStoredAudio: true, mimeType: "audio/x-flo" }),
        ),
      ).toBe("flo");
    });
  });
});

describe("BackendRouter", () => {
  let html: StubBackend;
  let flo: StubBackend;
  let symphonia: StubBackend;
  let router: BackendRouter;

  beforeEach(() => {
    html = new StubBackend();
    flo = new StubBackend();
    symphonia = new StubBackend();
    router = new BackendRouter(undefined, { html, flo, symphonia });
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
    expect(symphonia.calls).toHaveLength(0);
  });

  it("routes a regular remote track to the html backend", async () => {
    const track = makeTrack({ mimeType: "audio/mpeg" });
    await router.load("blob:mp3-url", track);

    expect(html.calls).toHaveLength(1);
    expect(flo.calls).toHaveLength(0);
    expect(symphonia.calls).toHaveLength(0);
  });

  it("routes stored audio through Symphonia", async () => {
    const track = makeTrack({ hasStoredAudio: true, mimeType: "audio/mpeg" });
    await router.load("blob:alac-url", track);

    expect(symphonia.calls).toHaveLength(1);
    expect(symphonia.calls[0]).toEqual({ url: "blob:alac-url", track });
    expect(html.calls).toHaveLength(0);
    expect(flo.calls).toHaveLength(0);
  });

  it("declines crossfade when no partner backend can be created", async () => {
    const track = makeTrack({ hasStoredAudio: true, mimeType: "audio/mpeg" });
    await expect(
      router.beginCrossfade("blob:alac-url", track, {
        durationMs: 3000,
        shape: "linear",
      }),
    ).resolves.toBe(false);
    expect(symphonia.calls).toHaveLength(0);
  });

  it("falls back through Symphonia to HTML", async () => {
    symphonia.failLoad = true;
    const track = makeTrack({ hasStoredAudio: true });
    await router.load("blob:stored-url", track);

    expect(symphonia.calls).toHaveLength(1);
    expect(html.calls).toHaveLength(1);
  });

  it("rethrows the html error when Symphonia and HTML also fail", async () => {
    symphonia.failLoad = true;
    html.failLoad = true;
    const track = makeTrack({ hasStoredAudio: true });

    await expect(router.load("blob:stored-url", track)).rejects.toThrow(
      "stub load failed: blob:stored-url",
    );
  });

  it("propagates the html error when the html load fails", async () => {
    html.failLoad = true;
    const track = makeTrack({ mimeType: "audio/mpeg" });

    await expect(router.load("blob:mp3-url", track)).rejects.toThrow(
      "stub load failed: blob:mp3-url",
    );
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

  it("returns no analyser once the shared graph is disposed", () => {
    router.dispose();
    expect(router.getAnalyser()).toBeNull();
  });

  it("disposes every inner backend at most once", () => {
    router.dispose();
    expect(html.isDisposed()).toBe(true);
    expect(flo.isDisposed()).toBe(true);
    expect(symphonia.isDisposed()).toBe(true);
  });
});