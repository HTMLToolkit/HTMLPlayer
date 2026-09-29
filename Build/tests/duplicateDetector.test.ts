import {
  DuplicateDetector,
  trackSignature,
  createDuplicateDetector,
} from "../src/platform/library/duplicateDetector";
import type { Track } from "../src/core/engine/types";

const SAMPLE_BYTES = 2048;

function createMockTrack(
  id: string,
  title: string,
  artist: string,
  album: string,
  url = `blob:http://localhost/${id}`,
): Track {
  return {
    id,
    title,
    artist,
    album,
    duration: 180,
    url,
  } as unknown as Track;
}

function makeBlob(fill: string): Blob {
  return new Blob([fill.repeat(SAMPLE_BYTES)]);
}

function mockFetchBlob(blob: Blob | null, fail = false): jest.Mock {
  const fetchMock = jest.fn(async () => {
    if (fail) throw new Error("fetch failed");
    if (blob === null) throw new Error("no blob");
    return { blob: async () => blob };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("trackSignature", () => {
  it("normalizes case across title, artist, and album", () => {
    expect(
      trackSignature({ title: "Songs", artist: "The Band", album: "Live" }),
    ).toBe("songs|the band|live");
  });
});

describe("DuplicateDetector.findDuplicatesByMetadata", () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = createDuplicateDetector();
  });

  it("groups tracks sharing a signature", () => {
    const a = createMockTrack("1", "Signal", "Artist", "Album");
    const b = createMockTrack("2", "signal", "artist", "album");
    const c = createMockTrack("3", "Signal", "Artist", "Album");

    const groups = detector.findDuplicatesByMetadata([a, b, c]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.representative.id).toBe("1");
    expect(groups[0]?.duplicates.map((t) => t.id)).toEqual(["2", "3"]);
  });

  it("leaves distinct signatures unmatched", () => {
    const a = createMockTrack("1", "One", "Artist", "Album");
    const b = createMockTrack("2", "Two", "Artist", "Album");

    expect(detector.findDuplicatesByMetadata([a, b])).toHaveLength(0);
  });
});

describe("DuplicateDetector.computeHash", () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = createDuplicateDetector();
  });

  it("matches the known SHA-256 of a small input", async () => {
    const hash = await detector.computeHash(new Blob(["abc"]));
    expect(hash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("produces a 64-character lowercase hex digest", async () => {
    const hash = await detector.computeHash(makeBlob("same-content"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes equal content identically", async () => {
    const a = await detector.computeHash(makeBlob("same-content"));
    const b = await detector.computeHash(makeBlob("same-content"));
    expect(a).toBe(b);
  });

  it("hashes different content differently", async () => {
    const a = await detector.computeHash(makeBlob("same-content"));
    const b = await detector.computeHash(makeBlob("other-content"));
    expect(a).not.toBe(b);
  });

  it("partial hash of a small file equals the full hash", async () => {
    const full = await detector.computeHash(makeBlob("same-content"));
    const partial = await detector.computePartialHash(makeBlob("same-content"));
    expect(partial).toBe(full);
  });
});

describe("DuplicateDetector.isConfirmedDuplicate", () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = createDuplicateDetector();
  });

  it("confirms a duplicate when metadata and content match", async () => {
    const blob = makeBlob("same-content");
    mockFetchBlob(blob);
    const existing = createMockTrack("1", "Signal", "Artist", "Album");

    const isDuplicate = await detector.isConfirmedDuplicate(
      makeBlob("same-content"),
      { title: "Signal", artist: "Artist", album: "Album" },
      [existing],
    );

    expect(isDuplicate).toBe(true);
  });

  it("does not flag same metadata with different content", async () => {
    mockFetchBlob(makeBlob("original-content"));
    const existing = createMockTrack("1", "Signal", "Artist", "Album");

    const isDuplicate = await detector.isConfirmedDuplicate(
      makeBlob("remuxed-content"),
      { title: "Signal", artist: "Artist", album: "Album" },
      [existing],
    );

    expect(isDuplicate).toBe(false);
  });

  it("does not compare content across different signatures", async () => {
    const fetchMock = mockFetchBlob(makeBlob("same-content"));

    const isDuplicate = await detector.isConfirmedDuplicate(
      makeBlob("same-content"),
      { title: "Other", artist: "Artist", album: "Album" },
      [createMockTrack("1", "Signal", "Artist", "Album")],
    );

    expect(isDuplicate).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores candidates without a fetchable blob URL", async () => {
    const fetchMock = mockFetchBlob(makeBlob("same-content"));
    const existing = createMockTrack(
      "1",
      "Signal",
      "Artist",
      "Album",
      "file:///stored.flac",
    );

    const isDuplicate = await detector.isConfirmedDuplicate(
      makeBlob("same-content"),
      { title: "Signal", artist: "Artist", album: "Album" },
      [existing],
    );

    expect(isDuplicate).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a failed fetch as non-duplicate", async () => {
    mockFetchBlob(makeBlob("same-content"), true);
    const existing = createMockTrack("1", "Signal", "Artist", "Album");

    const isDuplicate = await detector.isConfirmedDuplicate(
      makeBlob("same-content"),
      { title: "Signal", artist: "Artist", album: "Album" },
      [existing],
    );

    expect(isDuplicate).toBe(false);
  });
});