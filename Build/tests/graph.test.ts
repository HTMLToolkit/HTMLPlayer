import { AudioGraph } from "../src/platform/audio/graph";
import {
  BAND_COUNT,
  createDefaultBands,
  EQUALIZER_PRESETS,
  Equalizer,
  headroomDb,
  MAX_FREQUENCY_HZ,
  MAX_GAIN_DB,
  MAX_Q,
  MIN_GAIN_DB,
} from "../src/platform/audio/equalizer";

describe("AudioGraph", () => {
  let graph: AudioGraph;

  beforeEach(() => {
    graph = new AudioGraph();
  });

  afterEach(() => {
    graph.dispose();
  });

  it("exposes an analyser sized for the visualiser", () => {
    const analyser = graph.getAnalyser();
    expect(analyser).not.toBeNull();
    expect(analyser?.fftSize).toBe(2048);
  });

  it("reports no analyser once disposed", () => {
    graph.dispose();
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

  it("builds a biquad chain when the equalizer is enabled", () => {
    graph.setEqualizer(true);

    const equalizer = graph.getEqualizer();
    expect(equalizer.isEnabled()).toBe(true);
    expect(equalizer.isBuilt()).toBe(true);
    expect(equalizer.nodes).toHaveLength(BAND_COUNT);
  });

  it("updateEqualizer applies band edits to the live chain", () => {
    graph.setEqualizer(true);
    const equalizer = graph.getEqualizer();

    equalizer.setBandGain(2, -9);
    graph.updateEqualizer();

    const node = equalizer.nodes[2] as unknown as { gain: { value: number } };
    expect(node.gain.value).toBe(-9);
  });

  it("updateEqualizer does not allocate a second chain", () => {
    graph.setEqualizer(true);
    const equalizer = graph.getEqualizer();
    const first = equalizer.nodes[0];

    graph.updateEqualizer();

    expect(equalizer.nodes[0]).toBe(first);
  });

  it("updateEqualizer before a context exists does not throw", () => {
    expect(() => graph.updateEqualizer()).not.toThrow();
  });

  it("serializes dispose and retains state", () => {
    graph.setVolume(0.5);
    graph.dispose();
    expect(graph.getAnalyser()).toBeNull();
  });
});

describe("Equalizer", () => {
  let equalizer: Equalizer;
  let context: AudioContext;

  beforeEach(() => {
    equalizer = new Equalizer();
    context = new AudioContext();
  });

  it("exposes ten bands and presets", () => {
    expect(equalizer.getFrequencies()).toHaveLength(BAND_COUNT);
    expect(equalizer.getPresets()).toHaveLength(EQUALIZER_PRESETS.length);
    expect(equalizer.getGains()).toEqual(new Array(BAND_COUNT).fill(0));
  });

  it("applying a preset stores the band gains", () => {
    equalizer.setPreset(EQUALIZER_PRESETS[1]!);
    expect(equalizer.getGain(0)).toBe(6);

    equalizer.setFlat();
    expect(equalizer.getGains()).toEqual(new Array(BAND_COUNT).fill(0));
  });

  it("clamps stored gains to the band range", () => {
    equalizer.setBandGain(0, 50);
    equalizer.setBandGain(1, -50);
    expect(equalizer.getGain(0)).toBe(MAX_GAIN_DB);
    expect(equalizer.getGain(1)).toBe(MIN_GAIN_DB);
  });

  it("ignores out-of-range band setters", () => {
    equalizer.setBandGain(BAND_COUNT, 4);
    equalizer.setBandGain(-1, 4);
    expect(equalizer.getGains()).toEqual(new Array(BAND_COUNT).fill(0));
  });

  it("keeps bands set before the chain is built", () => {
    equalizer.setBandGain(0, 6);
    equalizer.setBandGain(3, -4);

    expect(equalizer.isBuilt()).toBe(false);
    expect(equalizer.getGains()[0]).toBe(6);
    expect(equalizer.getGains()[3]).toBe(-4);

    equalizer.build(context);

    expect(equalizer.nodes[0]?.gain.value).toBe(6);
    expect(equalizer.nodes[3]?.gain.value).toBe(-4);
  });

  it("creates one biquad per band and writes the band parameters", () => {
    equalizer.setBand(0, { frequency: 80, q: 2 });
    equalizer.build(context);

    const nodes = equalizer.nodes as unknown as Array<{
      type: string;
      frequency: { value: number };
      Q: { value: number };
    }>;

    expect(nodes).toHaveLength(BAND_COUNT);
    expect(nodes[0]?.type).toBe("lowshelf");
    expect(nodes[0]?.frequency.value).toBe(80);
    expect(nodes[0]?.Q.value).toBe(2);
    expect(nodes[1]?.type).toBe("peaking");
    expect(nodes[BAND_COUNT - 1]?.type).toBe("highshelf");
  });

  it("applies band edits to live nodes", () => {
    equalizer.build(context);
    equalizer.setBand(2, { gainDb: 9, frequency: 150, q: 3 });

    const node = equalizer.nodes[2] as unknown as {
      frequency: { value: number };
      gain: { value: number };
      Q: { value: number };
    };

    expect(node.frequency.value).toBe(150);
    expect(node.gain.value).toBe(9);
    expect(node.Q.value).toBe(3);
  });

  it("clamps band edits before they reach the node", () => {
    equalizer.build(context);
    equalizer.setBand(0, { gainDb: 40, frequency: 900_000, q: 999 });

    const node = equalizer.nodes[0] as unknown as {
      frequency: { value: number };
      gain: { value: number };
      Q: { value: number };
    };

    expect(node.gain.value).toBe(MAX_GAIN_DB);
    expect(node.frequency.value).toBe(MAX_FREQUENCY_HZ);
    expect(node.Q.value).toBe(MAX_Q);
  });

  it("keeps the previous bands when the band count is wrong", () => {
    equalizer.setBandGain(0, 6);
    equalizer.setBands(createDefaultBands().slice(0, 3));
    expect(equalizer.getGains()[0]).toBe(6);
    expect(equalizer.getGains()).toHaveLength(BAND_COUNT);
  });

  it("rebuilding does not allocate a second chain", () => {
    equalizer.build(context);
    const first = equalizer.nodes[0];
    equalizer.build(context);
    expect(equalizer.nodes[0]).toBe(first);
    expect(equalizer.nodes).toHaveLength(BAND_COUNT);
  });

  it("reset restores flat bands and disables the chain", () => {
    equalizer.setEnabled(true);
    equalizer.setPreset(EQUALIZER_PRESETS[1]!);

    equalizer.reset();

    expect(equalizer.isEnabled()).toBe(false);
    expect(equalizer.getGains()).toEqual(new Array(BAND_COUNT).fill(0));
  });

  it("getBands hands out copies", () => {
    const band = equalizer.getBand(0);
    expect(band).not.toBeNull();
    band!.gainDb = 11;
    expect(equalizer.getGain(0)).toBe(0);
  });

  it("disconnect without a built chain is a no-op", () => {
    expect(() => equalizer.disconnect()).not.toThrow();
  });
});

describe("headroomDb", () => {
  it("is zero for a flat curve", () => {
    expect(headroomDb(createDefaultBands())).toBe(0);
  });

  it("tracks the largest boost and ignores cuts", () => {
    const bands = createDefaultBands();
    bands[0] = { ...bands[0]!, gainDb: 6 };
    bands[5] = { ...bands[5]!, gainDb: -12 };
    expect(headroomDb(bands)).toBe(6);
  });
});
