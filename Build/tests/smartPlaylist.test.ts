import { SmartPlaylistEngine } from "../src/platform/library/smartPlaylist";
import { PointPerSongEngine } from "../src/platform/library/scoring";

function createMockTrack(id: string, artist: string, album: string, duration = 180) {
  return {
    id,
    title: `Track ${id}`,
    artist,
    album,
    duration,
    url: `file:///${id}.mp3`,
  };
}

describe("SmartPlaylistEngine", () => {
  let scoringEngine: PointPerSongEngine;
  let playlistEngine: SmartPlaylistEngine;

  beforeEach(() => {
    scoringEngine = new PointPerSongEngine();
    playlistEngine = new SmartPlaylistEngine(scoringEngine);
  });

  describe("generatePlaylist", () => {
    it("should return empty array for empty tracks", () => {
      const result = playlistEngine.generatePlaylist([], {
        name: "Test",
        rules: [],
      });
      expect(result).toHaveLength(0);
    });

    it("should return all tracks with no rules", () => {
      const tracks = [
        createMockTrack("1", "Artist1", "Album1"),
        createMockTrack("2", "Artist2", "Album2"),
      ];

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "Test",
        rules: [],
      });

      expect(result).toHaveLength(2);
    });

    it("should apply limit", () => {
      const tracks = [
        createMockTrack("1", "Artist1", "Album1"),
        createMockTrack("2", "Artist2", "Album2"),
        createMockTrack("3", "Artist3", "Album3"),
        createMockTrack("4", "Artist4", "Album4"),
      ];

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "Test",
        rules: [],
        limit: 2,
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("filter by artist", () => {
    it("should filter by artist name", () => {
      const tracks = [
        createMockTrack("1", "Radiohead", "Album1"),
        createMockTrack("2", "Muse", "Album2"),
        createMockTrack("3", "Radiohead", "Album3"),
      ];

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "Radiohead",
        rules: [{ type: "artist", value: "Radiohead" }],
      });

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.artist === "Radiohead")).toBe(true);
    });

    it("should use contains operator", () => {
      const tracks = [
        createMockTrack("1", "The Beatles", "Album1"),
        createMockTrack("2", "Beatles", "Album2"),
      ];

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "Beatles",
        rules: [{ type: "artist", operator: "contains", value: "beat" }],
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("filter by album", () => {
    it("should filter by album name", () => {
      const tracks = [
        createMockTrack("1", "Artist1", "OK Computer"),
        createMockTrack("2", "Artist2", "Album2"),
        createMockTrack("3", "Artist1", "OK Computer"),
      ];

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "OK Computer",
        rules: [{ type: "album", value: "OK Computer" }],
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("filter by play count", () => {
    it("should filter tracks with plays", () => {
      const tracks = [
        createMockTrack("1", "Artist1", "Album1"),
        createMockTrack("2", "Artist2", "Album2"),
      ];

      scoringEngine.recordPlay("1");
      scoringEngine.recordPlay("1");
      scoringEngine.recordPlay("1");

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "Played",
        rules: [{ type: "playcount", operator: "greaterThan", value: 1 }],
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should filter tracks with less than threshold", () => {
      const tracks = [
        createMockTrack("1", "Artist1", "Album1"),
        createMockTrack("2", "Artist2", "Album2"),
      ];

      scoringEngine.recordPlay("1");

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "Less played",
        rules: [{ type: "playcount", operator: "lessThan", value: 3 }],
      });

      expect(result).toHaveLength(1);
    });
  });

  describe("filter by recent", () => {
    it("should filter recently played tracks", () => {
      const tracks = [
        createMockTrack("1", "Artist1", "Album1"),
        createMockTrack("2", "Artist2", "Album2"),
      ];

      scoringEngine.recordPlay("1");

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "Recent",
        rules: [{ type: "recent", value: 365 }],
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });
  });

  describe("sorting", () => {
    it("should shuffle tracks", () => {
      const tracks = [
        createMockTrack("1", "Artist1", "Album1"),
        createMockTrack("2", "Artist2", "Album2"),
        createMockTrack("3", "Artist3", "Album3"),
      ];

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "Shuffle",
        rules: [],
        sortBy: "shuffle",
      });

      expect(result).toHaveLength(3);
    });

    it("should sort by score", () => {
      const tracks = [
        createMockTrack("1", "Artist1", "Album1"),
        createMockTrack("2", "Artist2", "Album2"),
      ];

      scoringEngine.setManualBoost("1", 5);

      const result = playlistEngine.generatePlaylist(tracks, {
        name: "By Score",
        rules: [],
        sortBy: "score",
      });

      expect(result[0].id).toBe("1");
    });
  });

  describe("default playlists", () => {
    it("should return default playlists", () => {
      const defaults = playlistEngine.getDefaultPlaylists();

      expect(defaults).toHaveLength(4);
      expect(defaults.map((p) => p.name)).toContain("Recently Played");
      expect(defaults.map((p) => p.name)).toContain("Least Played");
      expect(defaults.map((p) => p.name)).toContain("Top Rated");
      expect(defaults.map((p) => p.name)).toContain("Discover");
    });
  });
});
