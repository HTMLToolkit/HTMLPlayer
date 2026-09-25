import { AudioGraph } from "../src/platform/audio/graph";
import { EQUALIZER_PRESETS, Equalizer } from "../src/platform/audio/equalizer";

describe("AudioGraph", () => {
  let graph: AudioGraph;

  beforeEach(() => {
    graph = new AudioGraph();
  });

  afterEach(() => {
    graph.dispose();
  });

  it("returns no analyser when Web Audio is unavailable", () => {
    expect(graph.getAnalyser()).toBeNull();
  });

  it("stores and clamps volume without a live context", () => {
    graph.setVolume(1.5);
    expect(graph.getVolume()).toBe(1);

    graph.setVolume(-0.5);
    expect(graph.getVolume()).toBe(0);

    graph.setVolume(0.4);
    expect(graph.getVolume()).toBeCloseTo(0.4);
  });

  it("pitch 0 is a no-op without loading tone", async () => {
    await expect(graph.setPitch(0)).resolves.toBeUndefined();
    expect(graph.getPitchSemitones()).toBe(0);
    expect(graph.getPitchShiftNode()).toBeNull();
  });

  it("non-zero pitch records the target and degrades gracefully", async () => {
    await expect(graph.setPitch(6)).resolves.toBeUndefined();
    expect(graph.getPitchSemitones()).toBe(6);
  });

  it("clamps extreme pitch values", async () => {
    graph.setPitch(96);
    expect(graph.getPitchSemitones()).toBe(48);

    graph.setPitch(-96);
    expect(graph.getPitchSemitones()).toBe(-48);
  });

  it("survives enablng the equalizer without a live context", () => {
    expect(() => graph.setEqualizer(true)).not.toThrow();
    expect(graph.getEqualizer().isEnabled()).toBe(true);
  });

  it("serializes dispose and retains state", () => {
    graph.setVolume(0.5);
    graph.dispose();
    expect(graph.getAnalyser()).toBeNull();
  });
});

describe("Equalizer", () => {
  let equalizer: Equalizer;

  beforeEach(() => {
    equalizer = new Equalizer();
  });

  it("exposes ten bands and presets", () => {
    expect(equalizer.getFrequencies()).toHaveLength(10);
    expect(equalizer.getPresets()).toHaveLength(EQUALIZER_PRESETS.length);
    expect(equalizer.getGains()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("applying a preset stores the band gains", () => {
    equalizer.setPreset(EQUALIZER_PRESETS[1]!);
    expect(equalizer.getGain(0)).toBe(6);
    equalizer.setFlat();
    expect(equalizer.getGains()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("clamps stored gains to the band range", () => {
    equalizer.setGainUnbuilt(0, 50);
    equalizer.setGainUnbuilt(1, -50);
    expect(equalizer.getGain(0)).toBe(12);
    expect(equalizer.getGain(1)).toBe(-12);
  });

  it("ignores out-of-range band setters", () => {
    equalizer.setGainUnbuilt(10, 4);
    equalizer.setGainUnbuilt(-1, 4);
    expect(equalizer.getGains()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("disconnect without a built chain is a no-op", () => {
    expect(() => equalizer.disconnect()).not.toThrow();
  });
});