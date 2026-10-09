import { LyricsOvhProvider } from "../src/platform/providers/lyricsOvh";
import { LRCLyricsProvider } from "../src/platform/providers/lrcParser";
import { LyricsManager } from "../src/platform/providers/lyricsManager";

describe("LyricsOvhProvider", () => {
  let provider: LyricsOvhProvider;

  beforeEach(() => {
    provider = new LyricsOvhProvider();
  });

  it("should have correct name", () => {
    expect(provider.name).toBe("Lyrics.ovh");
  });

  it("should return null when artist is missing", async () => {
    const result = await provider.fetchLyrics({ title: "Test Song" });
    expect(result).toBeNull();
  });

  it("should return null when title is missing", async () => {
    const result = await provider.fetchLyrics({ artist: "Test Artist" });
    expect(result).toBeNull();
  });

  it("should return null for non-existent lyrics", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    });

    const result = await provider.fetchLyrics({
      artist: "NonExistentArtist12345",
      title: "NonExistentSong12345",
    });
    expect(result).toBeNull();
  });

  it("should parse lyrics from response", async () => {
    const mockLyrics = "Line 1\nLine 2\nLine 3";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ lyrics: mockLyrics }),
    });

    const result = await provider.fetchLyrics({
      artist: "Test Artist",
      title: "Test Song",
    });

    expect(result).not.toBeNull();
    expect(result?.data.plain).toContain("Line 1");
    expect(result?.source).toBe("Lyrics.ovh");
  });
});

describe("LRCLyricsProvider", () => {
  let provider: LRCLyricsProvider;

  beforeEach(() => {
    provider = new LRCLyricsProvider();
  });

  it("should have correct name", () => {
    expect(provider.name).toBe("LRC Parser");
  });

  it("should parse LRC content", () => {
    const lrc = `[00:12.34]First line
[00:45.67]Second line
[01:23.45]Third line`;

    const result = provider.parseLRC(lrc);

    expect(result.synced).toHaveLength(3);
    expect(result.synced[0].text).toBe("First line");
    expect(result.synced[0].time).toBe(12.34);
    expect(result.plain).toContain("First line");
    expect(result.source).toBe("LRC");
  });

  it("should handle multiple timestamps per line", () => {
    const lrc = `[00:10.00][00:30.00]Repeated line`;

    const result = provider.parseLRC(lrc);

    expect(result.synced).toHaveLength(2);
    expect(result.synced[0].text).toBe("Repeated line");
    expect(result.synced[0].time).toBe(10);
    expect(result.synced[1].time).toBe(30);
  });

  it("should sort synced lyrics by time", () => {
    const lrc = `[01:00.00]Third
[00:30.00]Second
[00:00.00]First`;

    const result = provider.parseLRC(lrc);

    expect(result.synced[0].time).toBe(0);
    expect(result.synced[1].time).toBe(30);
    expect(result.synced[2].time).toBe(60);
  });

  it("should handle empty lines", () => {
    const lrc = `First line

Second line`;

    const result = provider.parseLRC(lrc);

    expect(result.plain).toHaveLength(2);
  });
});

describe("LyricsManager", () => {
  let manager: LyricsManager;

  beforeEach(() => {
    manager = new LyricsManager();
  });

  it("should add provider", () => {
    const provider = new LyricsOvhProvider();
    manager.addProvider(provider);
  });

  it("should return null when no providers added", async () => {
    const result = await manager.fetchLyrics({
      artist: "Test",
      title: "Song",
    });
    expect(result).toBeNull();
  });

  it("should clear cache", () => {
    manager.clearCache();
  });
});
