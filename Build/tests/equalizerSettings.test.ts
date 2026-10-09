import {
  BAND_COUNT,
  createDefaultBands,
  EQUALIZER_PRESETS,
  MAX_GAIN_DB,
  sanitizeEqualizerState,
} from "../src/platform/audio/equalizer";

describe("sanitizeEqualizerState", () => {
  it("rejects non-object input", () => {
    expect(sanitizeEqualizerState(null)).toBeNull();
    expect(sanitizeEqualizerState("bands")).toBeNull();
    expect(sanitizeEqualizerState([1, 2])).toBeNull();
  });

  it("rejects a band list of the wrong length", () => {
    expect(
      sanitizeEqualizerState({
        enabled: true,
        bands: createDefaultBands().slice(0, 4),
      }),
    ).toBeNull();
    expect(sanitizeEqualizerState({ enabled: true, bands: [] })).toBeNull();
  });

  it("rejects a non-array band list", () => {
    expect(sanitizeEqualizerState({ enabled: true, bands: "ten" })).toBeNull();
    expect(sanitizeEqualizerState({ enabled: true })).toBeNull();
  });

  it("accepts a well formed configuration unchanged", () => {
    const preset = EQUALIZER_PRESETS[2]!;
    const state = sanitizeEqualizerState({
      enabled: true,
      presetName: preset.name,
      bands: preset.bands,
    });

    expect(state).toEqual({
      enabled: true,
      presetName: preset.name,
      bands: preset.bands,
    });
  });

  it("treats a non-boolean enabled flag as disabled", () => {
    const state = sanitizeEqualizerState({
      enabled: "yes",
      bands: createDefaultBands(),
    });

    expect(state?.enabled).toBe(false);
  });

  it("drops an unknown preset name but keeps a known one", () => {
    expect(
      sanitizeEqualizerState({
        enabled: true,
        presetName: "Made Up",
        bands: createDefaultBands(),
      })?.presetName,
    ).toBeNull();

    expect(
      sanitizeEqualizerState({
        enabled: true,
        presetName: EQUALIZER_PRESETS[1]?.name,
        bands: createDefaultBands(),
      })?.presetName,
    ).toBe(EQUALIZER_PRESETS[1]?.name);
  });

  it("clamps out of range band values", () => {
    const bands = createDefaultBands().map((band, index) =>
      index === 0 ? { ...band, gainDb: 99, frequency: -10, q: -1 } : band,
    );
    const state = sanitizeEqualizerState({ enabled: true, bands });

    expect(state?.bands[0]?.gainDb).toBe(MAX_GAIN_DB);
    expect(state?.bands[0]?.frequency).toBe(20);
  });

  it("replaces a non-finite numeric field from the default band", () => {
    const bands = createDefaultBands().map((band, index) =>
      index === 2 ? { ...band, gainDb: null, frequency: "500" } : band,
    );
    const state = sanitizeEqualizerState({ enabled: true, bands });
    const fallback = createDefaultBands()[2]!;

    expect(state?.bands[2]?.gainDb).toBe(fallback.gainDb);
    expect(state?.bands[2]?.frequency).toBe(fallback.frequency);
  });

  it("replaces an unknown band type with the default type", () => {
    const bands = createDefaultBands().map((band, index) =>
      index === 1 ? { ...band, type: "phase" } : band,
    );
    const state = sanitizeEqualizerState({ enabled: true, bands });

    expect(state?.bands[1]?.type).toBe(createDefaultBands()[1]?.type);
  });

  it("repairs a non-object band without losing the layout", () => {
    const bands = [...createDefaultBands()];
    bands[4] = null;
    const state = sanitizeEqualizerState({ enabled: true, bands });

    expect(state?.bands).toHaveLength(BAND_COUNT);
    expect(state?.bands[4]).toEqual(createDefaultBands()[4]);
  });
});
