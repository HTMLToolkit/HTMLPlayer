import { PointPerSongEngine } from "../src/platform/library/scoring";

describe("PointPerSongEngine", () => {
  let engine: PointPerSongEngine;

  beforeEach(() => {
    engine = new PointPerSongEngine();
  });

  describe("Initial state", () => {
    it("should start with no scores", () => {
      expect(engine.getAllScores().size).toBe(0);
    });

    it("should return 0 for unknown track", () => {
      expect(engine.getScore("unknown")).toBe(0);
    });
  });

  describe("Recording plays", () => {
    it("should record a play and create score", () => {
      engine.recordPlay("track-1");
      expect(engine.getScore("track-1")).toBeGreaterThan(0);
    });

    it("should increment play count on subsequent plays", () => {
      engine.recordPlay("track-1");
      const firstScore = engine.getScore("track-1");
      engine.recordPlay("track-1");
      const secondScore = engine.getScore("track-1");
      expect(secondScore).toBeGreaterThanOrEqual(firstScore);
    });
  });

  describe("Recording skips", () => {
    it("should decay score on skip", () => {
      engine.recordPlay("track-1");
      const playScore = engine.getScore("track-1");
      engine.recordSkip("track-1");
      const skipScore = engine.getScore("track-1");
      expect(skipScore).toBeLessThan(playScore);
    });
  });

  describe("Manual boost", () => {
    it("should apply positive boost", () => {
      engine.recordPlay("track-1");
      const baseScore = engine.getScore("track-1");
      engine.setManualBoost("track-1", 5);
      const boostedScore = engine.getScore("track-1");
      expect(boostedScore).toBeGreaterThan(baseScore);
    });

    it("should apply negative boost", () => {
      engine.recordPlay("track-1");
      const baseScore = engine.getScore("track-1");
      engine.setManualBoost("track-1", -5);
      const reducedScore = engine.getScore("track-1");
      expect(reducedScore).toBeLessThan(baseScore);
    });

    it("should clamp boost to -10 to 10", () => {
      engine.setManualBoost("track-1", 100);
      const data = (engine as unknown as { scores: Map<string, { manualBoost: number }> }).scores.get("track-1");
      expect(data?.manualBoost).toBe(10);
    });
  });

  describe("Weighted random selection", () => {
    it("should return single track when only one available", () => {
      const result = engine.getWeightedRandomTrack(["track-1"]);
      expect(result).toBe("track-1");
    });

    it("should return null for empty array", () => {
      const result = engine.getWeightedRandomTrack([]);
      expect(result).toBeNull();
    });

    it("should return a track from the provided list", () => {
      const trackIds = ["a", "b", "c", "d", "e"];
      engine.recordPlay("a");
      engine.recordPlay("b");
      engine.recordPlay("c");
      engine.setManualBoost("a", 10);

      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const result = engine.getWeightedRandomTrack(trackIds);
        if (result) results.add(result);
      }

      expect(results.size).toBeGreaterThan(0);
    });
  });

  describe("Top tracks", () => {
    it("should return top N tracks by score", () => {
      engine.recordPlay("low");
      engine.setManualBoost("high", 10);
      engine.recordPlay("medium");

      const top = engine.getTopTracks(["low", "high", "medium"], 2);
      expect(top).toContain("high");
      expect(top.length).toBe(2);
    });

    it("should handle unknown tracks", () => {
      const top = engine.getTopTracks(["unknown-1", "unknown-2"], 5);
      expect(top.length).toBe(2);
    });
  });

  describe("Current track", () => {
    it("should set current track for similarity scoring", () => {
      engine.setCurrentTrack("current-track");
      const data = (engine as unknown as { currentTrackId: string }).currentTrackId;
      expect(data).toBe("current-track");
    });
  });

  describe("State management", () => {
    it("should save and restore state", () => {
      engine.recordPlay("track-1");
      engine.setManualBoost("track-1", 5);
      const saved = engine.getState();

      const newEngine = new PointPerSongEngine();
      newEngine.setState(saved);
      expect(newEngine.getScore("track-1")).toBe(engine.getScore("track-1"));
    });

    it("should clear all scores", () => {
      engine.recordPlay("track-1");
      engine.recordPlay("track-2");
      engine.clear();
      expect(engine.getAllScores().size).toBe(0);
    });
  });

  describe("Custom config", () => {
    it("should use custom config", () => {
      const customEngine = new PointPerSongEngine({
        inversePlayCountWeight: 5,
        freshnessWeight: 0,
        manualWeight: 10,
      });

      customEngine.recordPlay("track-1");
      customEngine.setManualBoost("track-1", 1);

      const data = (customEngine as unknown as { config: { inversePlayCountWeight: number; manualWeight: number } }).config;
      expect(data.inversePlayCountWeight).toBe(5);
      expect(data.manualWeight).toBe(10);
    });
  });
});