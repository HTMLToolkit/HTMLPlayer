import { StateMachine } from "../src/core/engine/state";
import { QueueManager } from "../src/core/engine/queue";
import { Scheduler, CrossfadeScheduler, GaplessScheduler } from "../src/core/engine/scheduler";
import { KomorebiEngine, IAudioBackend } from "../src/core/engine/engine";
import type { Track, Playlist } from "../src/core/engine/types";

const createMockTrack = (id: string, duration = 180): Track => ({
  id,
  title: `Track ${id}`,
  artist: "Test Artist",
  album: "Test Album",
  duration,
  url: `file:///test/${id}.mp3`,
});

const createMockPlaylist = (trackIds: string[]): Playlist => ({
  id: "test-playlist",
  name: "Test Playlist",
  songs: trackIds.map(createMockTrack),
});

const createMockBackend = (): IAudioBackend => ({
  load: jest.fn().mockResolvedValue(undefined),
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  stop: jest.fn(),
  seek: jest.fn(),
  setVolume: jest.fn(),
  setPlaybackRate: jest.fn(),
  getCurrentTime: () => 0,
  getDuration: () => 180,
  onTimeUpdate: jest.fn(),
  onEnded: jest.fn(),
  onError: jest.fn(),
  dispose: jest.fn(),
});

describe("StateMachine", () => {
  it("should start in idle state", () => {
    const sm = new StateMachine();
    expect(sm.getState()).toBe("idle");
  });

  it("should transition from idle to loading", () => {
    const sm = new StateMachine();
    const result = sm.transition("loading");
    expect(result).toBe(true);
    expect(sm.getState()).toBe("loading");
  });

  it("should not allow invalid transitions", () => {
    const sm = new StateMachine();
    sm.transition("loading");
    const result = sm.transition("playing");
    expect(result).toBe(false);
    expect(sm.getState()).toBe("loading");
  });

  it("should force transition when needed", () => {
    const sm = new StateMachine();
    sm.transition("loading");
    const result = sm.transition("playing", true);
    expect(result).toBe(true);
    expect(sm.getState()).toBe("playing");
  });

  it("should report playing state correctly", () => {
    const sm = new StateMachine();
    expect(sm.isPlaying()).toBe(false);
    sm.transition("playing");
    expect(sm.isPlaying()).toBe(true);
  });

  it("should track history", () => {
    const sm = new StateMachine();
    sm.transition("loading");
    sm.transition("ready");
    sm.transition("playing");
    expect(sm.getHistory().length).toBe(3);
  });
});

describe("QueueManager", () => {
  let queue: QueueManager;

  beforeEach(() => {
    queue = new QueueManager();
  });

  it("should set playlist", () => {
    const playlist = createMockPlaylist(["a", "b", "c"]);
    queue.setPlaylist(playlist);
    expect(queue.getTracks().length).toBe(3);
  });

  it("should get current track", () => {
    const playlist = createMockPlaylist(["a", "b", "c"]);
    queue.setPlaylist(playlist);
    queue.setCurrentIndex(1);
    expect(queue.getCurrentTrack()?.id).toBe("b");
  });

  it("should handle next track", () => {
    const playlist = createMockPlaylist(["a", "b", "c"]);
    queue.setPlaylist(playlist);
    queue.setCurrentIndex(0);
    const next = queue.getNextTrack(false);
    expect(next?.id).toBe("b");
  });

  it("should handle previous track", () => {
    const playlist = createMockPlaylist(["a", "b", "c"]);
    queue.setPlaylist(playlist);
    queue.setCurrentIndex(1);
    const prev = queue.getPreviousTrack(false);
    expect(prev?.id).toBe("a");
  });

  it("should wrap around at end of playlist", () => {
    const playlist = createMockPlaylist(["a", "b", "c"]);
    queue.setPlaylist(playlist);
    queue.setCurrentIndex(2);
    const next = queue.getNextTrack(false);
    expect(next?.id).toBe("a");
  });

  it("should wrap around at start of playlist", () => {
    const playlist = createMockPlaylist(["a", "b", "c"]);
    queue.setPlaylist(playlist);
    queue.setCurrentIndex(0);
    const prev = queue.getPreviousTrack(false);
    expect(prev?.id).toBe("c");
  });

  it("should shuffle tracks", () => {
    const playlist = createMockPlaylist(["a", "b", "c", "d", "e"]);
    queue.setPlaylist(playlist);
    queue.setCurrentIndex(2);
    queue.shuffle(true);
    expect(queue.isShuffled()).toBe(true);
    expect(queue.getTracks().length).toBe(5);
  });

  it("should unshuffle tracks", () => {
    const playlist = createMockPlaylist(["a", "b", "c"]);
    queue.setPlaylist(playlist);
    queue.shuffle();
    queue.unshuffle();
    expect(queue.isShuffled()).toBe(false);
  });

  it("should update play history", () => {
    queue.updateHistory("track-1");
    const history = queue.getPlayHistory("track-1");
    expect(history?.playCount).toBe(1);

    queue.updateHistory("track-1");
    const history2 = queue.getPlayHistory("track-1");
    expect(history2?.playCount).toBe(2);
  });

  it("should add tracks", () => {
    queue.addTrack(createMockTrack("new"));
    expect(queue.getTracks().length).toBe(1);
  });

  it("should remove tracks", () => {
    queue.addTrack(createMockTrack("a"));
    queue.addTrack(createMockTrack("b"));
    queue.removeTrack("a");
    expect(queue.getTracks().length).toBe(1);
    expect(queue.getTracks()[0]?.id).toBe("b");
  });
});

describe("CrossfadeScheduler", () => {
  let scheduler: CrossfadeScheduler;

  beforeEach(() => {
    scheduler = new CrossfadeScheduler();
  });

  it("should start disabled", () => {
    expect(scheduler.isEnabled()).toBe(false);
  });

  it("should enable crossfade", () => {
    scheduler.setConfig({ enabled: true, duration: 3000, shape: "equalpower" });
    expect(scheduler.isEnabled()).toBe(true);
  });

  it("should calculate trigger time", () => {
    scheduler.setConfig({ enabled: true, duration: 3000, shape: "linear" });
    const trigger = scheduler.calculateTriggerTime(180, 0);
    expect(trigger).toBe(177);
  });

  it("should calculate equalpower curve", () => {
    scheduler.setConfig({ enabled: true, duration: 1000, shape: "equalpower" });
    const { fromVolume, toVolume } = scheduler.calculateVolumes(0.5);
    expect(fromVolume).toBeCloseTo(0.707, 2);
    expect(toVolume).toBeCloseTo(0.707, 2);
  });

  it("should calculate linear curve", () => {
    scheduler.setConfig({ enabled: true, duration: 1000, shape: "linear" });
    const { fromVolume, toVolume } = scheduler.calculateVolumes(0.5);
    expect(fromVolume).toBe(0.5);
    expect(toVolume).toBe(0.5);
  });
});

describe("GaplessScheduler", () => {
  let scheduler: GaplessScheduler;

  beforeEach(() => {
    scheduler = new GaplessScheduler();
  });

  it("should start enabled", () => {
    expect(scheduler.isEnabled()).toBe(true);
  });

  it("should get start offset from track", () => {
    const track = createMockTrack("a", 180);
    track.gapless = { encoderDelay: 100, encoderPadding: 50 };
    expect(scheduler.getStartOffset(track)).toBe(100);
  });

  it("should calculate play end with offset", () => {
    const track = createMockTrack("a", 180);
    track.gapless = { encoderDelay: 0, encoderPadding: 50 };
    expect(scheduler.calculatePlayEnd(track)).toBe(130);
  });
});

describe("Scheduler", () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  it("should prioritize gapless over crossfade", () => {
    scheduler.setCrossfadeConfig({ enabled: true, duration: 3000, shape: "linear" });
    scheduler.setGaplessConfig({ enabled: true });
    expect(scheduler.getMode()).toBe("gapless");
  });

  it("should use crossfade when gapless disabled", () => {
    scheduler.setCrossfadeConfig({ enabled: true, duration: 3000, shape: "linear" });
    scheduler.setGaplessConfig({ enabled: false });
    expect(scheduler.getMode()).toBe("crossfade");
  });
});

describe("KomorebiEngine", () => {
  let engine: KomorebiEngine;
  let backend: ReturnType<typeof createMockBackend>;

  beforeEach(() => {
    backend = createMockBackend();
    engine = new KomorebiEngine({
      crossfade: { enabled: false, duration: 0, shape: "linear" },
      gapless: { enabled: true },
      smartShuffle: true,
      autoPlayNext: true,
    });
    engine.setBackend(backend);
  });

  afterEach(() => {
    engine.dispose();
    jest.clearAllMocks();
  });

  it("should start in idle state", () => {
    expect(engine.getState().state).toBe("idle");
  });

  it("should load track and transition to ready", () => {
    const track = createMockTrack("test-1");
    engine.load(track);
    expect(engine.getState().state).toBe("ready");
  });

  it("should play track", async () => {
    const track = createMockTrack("test-1");
    engine.load(track);
    await engine.play();
    expect(engine.getState().state).toBe("playing");
  });

  it("should pause track", async () => {
    const track = createMockTrack("test-1");
    engine.load(track);
    await engine.play();
    engine.pause();
    expect(engine.getState().state).toBe("paused");
  });

  it("should emit state change events", async () => {
    const states: string[] = [];
    engine.on("statechange", (e) => states.push(e.newState));

    const track = createMockTrack("test-1");
    engine.load(track);
    await engine.play();
    engine.pause();

    expect(states).toContain("ready");
    expect(states).toContain("playing");
    expect(states).toContain("paused");
  });

  it("should emit track change events", async () => {
    const changes: Array<{ from: string | null; to: string | null }> = [];
    engine.on("trackchange", (e) => {
      changes.push({ from: e.from?.id ?? null, to: e.to?.id ?? null });
    });

    const playlist = createMockPlaylist(["a", "b", "c"]);
    engine.setPlaylist(playlist);
    engine.load(playlist.songs[0]);
    await engine.play();
    await engine.next();

    expect(changes.length).toBeGreaterThan(0);
  });

  it("should handle volume changes", () => {
    engine.setVolume(0.5);
    expect(engine.getState().settings.volume).toBe(0.5);
    expect(backend.setVolume).toHaveBeenCalledWith(0.5);
  });

  it("should clamp volume", () => {
    engine.setVolume(1.5);
    expect(engine.getState().settings.volume).toBe(1);

    engine.setVolume(-0.5);
    expect(engine.getState().settings.volume).toBe(0);
  });

  it("should handle tempo changes", () => {
    engine.setTempo(1.5);
    expect(engine.getState().settings.tempo).toBe(1.5);
    expect(backend.setPlaybackRate).toHaveBeenCalledWith(1.5);
  });

  it("should clamp tempo", () => {
    engine.setTempo(5);
    expect(engine.getState().settings.tempo).toBe(4);

    engine.setTempo(0.1);
    expect(engine.getState().settings.tempo).toBe(0.25);
  });

  it("should toggle shuffle", () => {
    expect(engine.getState().queue.shuffled).toBe(false);
    engine.toggleShuffle();
    expect(engine.getState().queue.shuffled).toBe(true);
    engine.toggleShuffle();
    expect(engine.getState().queue.shuffled).toBe(false);
  });

  it("should cycle repeat mode", () => {
    expect(engine.getState().settings.repeat).toBe("off");
    engine.toggleRepeat();
    expect(engine.getState().settings.repeat).toBe("all");
    engine.toggleRepeat();
    expect(engine.getState().settings.repeat).toBe("one");
    engine.toggleRepeat();
    expect(engine.getState().settings.repeat).toBe("off");
  });

  it("should seek to position", () => {
    const track = createMockTrack("test-1", 300);
    engine.load(track);
    engine.seek(60);
    expect(backend.seek).toHaveBeenCalledWith(60);
  });

  it("should handle crossfade settings", () => {
    engine.setCrossfade(3000);
    const scheduler = engine.getScheduler();
    expect(scheduler.getCrossfade().isEnabled()).toBe(true);
  });

  it("should handle gapless settings", () => {
    engine.setGapless(false);
    expect(engine.getState().settings.gaplessPlayback).toBe(false);
  });

  it("should get current track", () => {
    const track = createMockTrack("test-1");
    engine.load(track);
    expect(engine.getCurrentTrack()?.id).toBe("test-1");
  });

  it("should update settings", () => {
    engine.updateSettings({
      volume: 0.8,
      pitch: 2,
    });
    expect(engine.getState().settings.volume).toBe(0.8);
    expect(engine.getState().settings.pitch).toBe(2);
  });
});