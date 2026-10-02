import type { FilterType, GraphFilter } from "dsssp";
import type {
  EqualizerBand,
  EqualizerBandType,
} from "../../../platform/audio/equalizer";

const DSSSP_TYPE_BY_BAND_TYPE: Record<EqualizerBandType, FilterType> = {
  lowshelf: "LOWSHELF1",
  highshelf: "HIGHSHELF1",
  peaking: "PEAK",
  lowpass: "LOWPASS1",
  highpass: "HIGHPASS1",
  bandpass: "BANDPASS",
  notch: "NOTCH",
};

const BAND_TYPE_BY_DSSP_TYPE: Record<string, EqualizerBandType> = {
  LOWSHELF1: "lowshelf",
  LOWSHELF2: "lowshelf",
  HIGHSHELF1: "highshelf",
  HIGHSHELF2: "highshelf",
  PEAK: "peaking",
  GAIN: "peaking",
  BYPASS: "peaking",
  LOWPASS1: "lowpass",
  LOWPASS2: "lowpass",
  HIGHPASS1: "highpass",
  HIGHPASS2: "highpass",
  BANDPASS: "bandpass",
  NOTCH: "notch",
};

export function bandToGraphFilter(band: EqualizerBand): GraphFilter {
  return {
    type: DSSSP_TYPE_BY_BAND_TYPE[band.type],
    freq: band.frequency,
    gain: band.gainDb,
    q: band.q,
  };
}

export function bandsToGraphFilters(bands: EqualizerBand[]): GraphFilter[] {
  return bands.map(bandToGraphFilter);
}

export function graphFilterToBandPatch(filter: GraphFilter): {
  type: EqualizerBandType;
  frequency: number;
  gainDb: number;
  q: number;
} {
  return {
    type: BAND_TYPE_BY_DSSP_TYPE[filter.type] ?? "peaking",
    frequency: filter.freq,
    gainDb: filter.gain,
    q: filter.q,
  };
}
