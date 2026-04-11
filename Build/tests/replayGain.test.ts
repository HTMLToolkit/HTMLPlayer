import { parseReplayGainTags } from "../src/platform/audio/replayGain";

describe("ReplayGain", () => {
  describe("parseReplayGainTags", () => {
    it("should parse track gain", () => {
      const tags = {
        REPLAYGAIN_TRACK_GAIN: "-6.0 dB",
      };

      const result = parseReplayGainTags(tags);

      expect(result?.trackGain).toBe(-6);
    });

    it("should parse track peak", () => {
      const tags = {
        REPLAYGAIN_TRACK_PEAK: "0.987654",
      };

      const result = parseReplayGainTags(tags);

      expect(result?.trackPeak).toBeCloseTo(0.987654);
    });

    it("should parse album gain", () => {
      const tags = {
        REPLAYGAIN_ALBUM_GAIN: "-8.5 dB",
      };

      const result = parseReplayGainTags(tags);

      expect(result?.albumGain).toBe(-8.5);
    });

    it("should parse album peak", () => {
      const tags = {
        REPLAYGAIN_ALBUM_PEAK: "1.0",
      };

      const result = parseReplayGainTags(tags);

      expect(result?.albumPeak).toBe(1);
    });

    it("should parse reference loudness", () => {
      const tags = {
        REPLAYGAIN_REFERENCE_LOUDNESS: "89.0 dB",
      };

      const result = parseReplayGainTags(tags);

      expect(result?.referenceLoudness).toBe(89);
    });

    it("should return null for empty tags", () => {
      const result = parseReplayGainTags({});
      expect(result).toBeNull();
    });

    it("should parse multiple tags", () => {
      const tags = {
        REPLAYGAIN_TRACK_GAIN: "-6.0 dB",
        REPLAYGAIN_TRACK_PEAK: "0.95",
        REPLAYGAIN_ALBUM_GAIN: "-7.0 dB",
        REPLAYGAIN_REFERENCE_LOUDNESS: "89.0 dB",
      };

      const result = parseReplayGainTags(tags);

      expect(result?.trackGain).toBe(-6);
      expect(result?.trackPeak).toBeCloseTo(0.95);
      expect(result?.albumGain).toBe(-7);
      expect(result?.referenceLoudness).toBe(89);
    });

    it("should handle positive gain values", () => {
      const tags = {
        REPLAYGAIN_TRACK_GAIN: "+3.0 dB",
      };

      const result = parseReplayGainTags(tags);

      expect(result?.trackGain).toBe(3);
    });

    it("should handle decimal values", () => {
      const tags = {
        REPLAYGAIN_TRACK_GAIN: "-6.54321 dB",
      };

      const result = parseReplayGainTags(tags);

      expect(result?.trackGain).toBeCloseTo(-6.54321);
    });
  });
});
