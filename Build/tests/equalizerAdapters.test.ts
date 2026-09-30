import {
  bandToGraphFilter,
  bandsToGraphFilters,
  graphFilterToBandPatch,
} from "../src/ui/components/features/equalizerAdapters";
import {
  BAND_COUNT,
  createDefaultBands,
  type EqualizerBand,
  type EqualizerBandType,
} from "../src/platform/audio/equalizer";

const EVERY_BAND_TYPE: EqualizerBandType[] = [
  "lowshelf",
  "peaking",
  "highshelf",
  "lowpass",
  "highpass",
  "bandpass",
  "notch",
];

describe("bandToGraphFilter", () => {
  it("maps band frequency, gain and q onto the dsssp field names", () => {
    const band: EqualizerBand = {
      type: "peaking",
      frequency: 1000,
      gainDb: -3.5,
      q: 2.25,
    };

    expect(bandToGraphFilter(band)).toEqual({
      type: "PEAK",
      freq: 1000,
      gain: -3.5,
      q: 2.25,
    });
  });

  it("maps shelves onto the single shelf variants", () => {
    expect(bandToGraphFilter(createDefaultBands()[0]!).type).toBe("LOWSHELF1");
    expect(bandToGraphFilter(createDefaultBands().at(-1)!).type).toBe(
      "HIGHSHELF1",
    );
  });

  it("maps every band type onto a distinct dsssp type", () => {
    const types = EVERY_BAND_TYPE.map(
      (type) => bandToGraphFilter({ ...createDefaultBands()[0]!, type }).type,
    );

    expect(new Set(types).size).toBe(EVERY_BAND_TYPE.length);
  });

  it("round trips a band through the graph filter unchanged", () => {
    const band = createDefaultBands()[3]!;
    const patch = graphFilterToBandPatch(bandToGraphFilter(band));

    expect(patch.type).toBe(band.type);
    expect(patch.frequency).toBe(band.frequency);
    expect(patch.gainDb).toBe(band.gainDb);
    expect(patch.q).toBe(band.q);
  });
});

describe("bandsToGraphFilters", () => {
  it("preserves band order and length", () => {
    const bands = createDefaultBands();
    const filters = bandsToGraphFilters(bands);

    expect(filters).toHaveLength(BAND_COUNT);
    expect(filters.map((filter) => filter.freq)).toEqual(
      bands.map((band) => band.frequency),
    );
  });

  it("returns an empty list for no bands", () => {
    expect(bandsToGraphFilters([])).toEqual([]);
  });
});

describe("graphFilterToBandPatch", () => {
  it("falls back to a peaking band for an unknown dsssp type", () => {
    const patch = graphFilterToBandPatch({
      type: "GAIN" as never,
      freq: 500,
      gain: 2,
      q: 1,
    });

    expect(patch.type).toBe("peaking");
  });

  it("keeps the reported q so a wheel adjustment survives the round trip", () => {
    const patch = graphFilterToBandPatch({
      type: "PEAK",
      freq: 800,
      gain: -6,
      q: 7.5,
    });

    expect(patch.q).toBe(7.5);
  });
});
