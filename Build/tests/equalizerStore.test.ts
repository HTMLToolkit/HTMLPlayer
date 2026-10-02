import { useKomorebiStore } from "../src/store";
import {
  BAND_COUNT,
  EQUALIZER_PRESETS,
  findPreset,
  MAX_GAIN_DB,
  MAX_Q,
  MIN_GAIN_DB,
} from "../src/platform/audio/equalizer";

const ROCK = findPreset("Rock")!;

function currentEqualizer() {
  return useKomorebiStore.getState().equalizer;
}

describe("equalizer store slice", () => {
  beforeEach(() => {
    useKomorebiStore.getState().resetEqualizer();
  });

  it("starts disabled, flat, with the default band layout", () => {
    const state = currentEqualizer();

    expect(state.enabled).toBe(false);
    expect(state.presetName).toBe("Flat");
    expect(state.bands).toHaveLength(BAND_COUNT);
    expect(state.bands.every((band) => band.gainDb === 0)).toBe(true);
    expect(state.bands[0]?.type).toBe("lowshelf");
    expect(state.bands.at(-1)?.type).toBe("highshelf");
  });

  it("toggles enabled without touching the bands", () => {
    useKomorebiStore.getState().setEqualizerEnabled(true);

    expect(currentEqualizer().enabled).toBe(true);
    expect(currentEqualizer().bands).toHaveLength(BAND_COUNT);
  });

  it("applies a preset and records its name", () => {
    useKomorebiStore.getState().applyEqualizerPreset(ROCK);

    const state = currentEqualizer();
    expect(state.enabled).toBe(true);
    expect(state.presetName).toBe("Rock");
    expect(state.bands.map((band) => band.gainDb)).toEqual(
      ROCK.bands.map((band) => band.gainDb),
    );
  });

  it("clears the preset name once a band is edited away from it", () => {
    useKomorebiStore.getState().applyEqualizerPreset(ROCK);
    useKomorebiStore.getState().patchEqualizerBand(0, { gainDb: 1 });

    expect(currentEqualizer().presetName).toBeNull();
  });

  it("restores the preset name when an edit lands back on the preset", () => {
    const target = ROCK.bands[0]!;

    useKomorebiStore.getState().applyEqualizerPreset(ROCK);
    useKomorebiStore.getState().patchEqualizerBand(0, { gainDb: 1 });
    useKomorebiStore
      .getState()
      .patchEqualizerBand(0, { gainDb: target.gainDb });

    expect(currentEqualizer().presetName).toBe("Rock");
  });

  it("enables the equalizer when a band is edited", () => {
    useKomorebiStore.getState().setEqualizerEnabled(false);
    useKomorebiStore.getState().patchEqualizerBand(2, { gainDb: 3 });

    expect(currentEqualizer().enabled).toBe(true);
  });

  it("clamps band edits to the audio layer limits", () => {
    useKomorebiStore.getState().patchEqualizerBand(1, {
      gainDb: 80,
      frequency: 10,
      q: 500,
    });

    const band = currentEqualizer().bands[1];
    expect(band?.gainDb).toBe(MAX_GAIN_DB);
    expect(band?.frequency).toBe(20);
    expect(band?.q).toBe(MAX_Q);
  });

  it("ignores an edit to a band that does not exist", () => {
    const before = currentEqualizer().bands;
    useKomorebiStore.getState().patchEqualizerBand(99, { gainDb: 6 });

    expect(currentEqualizer().bands).toBe(before);
  });

  it("clamps a whole band set and matches the preset", () => {
    useKomorebiStore
      .getState()
      .setEqualizerBands(ROCK.bands.map((band) => ({ ...band, gainDb: 99 })));

    const state = currentEqualizer();
    expect(state.presetName).toBeNull();
    expect(state.bands.every((band) => band.gainDb <= MAX_GAIN_DB)).toBe(true);
  });

  it("reports a matching preset for a custom band set", () => {
    useKomorebiStore.getState().setEqualizerBands(ROCK.bands);

    expect(currentEqualizer().presetName).toBe("Rock");
  });

  it("reset restores the initial state", () => {
    useKomorebiStore.getState().applyEqualizerPreset(ROCK);
    useKomorebiStore.getState().resetEqualizer();

    const state = currentEqualizer();
    expect(state.enabled).toBe(false);
    expect(state.presetName).toBe("Flat");
    expect(state.bands.every((band) => band.gainDb === 0)).toBe(true);
  });

  it("hydrate restores a persisted configuration", () => {
    const bands = ROCK.bands.map((band) => ({ ...band, gainDb: 2 }));
    useKomorebiStore
      .getState()
      .hydrateEqualizer({ enabled: true, presetName: "Rock", bands });

    const state = currentEqualizer();
    expect(state.enabled).toBe(true);
    expect(state.bands.map((band) => band.gainDb)).toEqual(bands.map((b) => b.gainDb));
  });

  it("hydrate clamps a tampered persisted configuration", () => {
    useKomorebiStore.getState().hydrateEqualizer({
      enabled: true,
      presetName: "Not A Preset",
      bands: Array.from({ length: BAND_COUNT }, () => ({
        type: "peaking" as const,
        frequency: -5,
        gainDb: -999,
        q: -3,
      })),
    });

    const state = currentEqualizer();
    expect(state.bands.every((band) => band.frequency === 20)).toBe(true);
    expect(state.bands.every((band) => band.gainDb === MIN_GAIN_DB)).toBe(true);
  });

  it("every shipped preset is a full ten band layout", () => {
    for (const preset of EQUALIZER_PRESETS) {
      expect(preset.bands).toHaveLength(BAND_COUNT);
    }
  });
});
