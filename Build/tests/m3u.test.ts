import {
  m3uBaseName,
  normalizeM3uPath,
  parseM3u,
  playlistFileName,
  serializeM3u,
} from "../src/platform/library/m3u";
import { describe, it, expect } from "@jest/globals";

describe("normalizeM3uPath", () => {
  it("keeps a plain relative path intact", () => {
    expect(normalizeM3uPath("Album/01 Song.mp3")).toBe("Album/01 Song.mp3");
  });

  it("converts windows separators", () => {
    expect(normalizeM3uPath("Album\\Sub\\song.flac")).toBe("Album/Sub/song.flac");
  });

  it("strips a windows drive letter", () => {
    expect(normalizeM3uPath("C:\\Music\\song.mp3")).toBe("Music/song.mp3");
  });

  it("decodes a file url to its path", () => {
    expect(normalizeM3uPath("file:///C:/Music/My%20Song.mp3")).toBe(
      "Music/My Song.mp3",
    );
  });

  it("collapses dot segments", () => {
    expect(normalizeM3uPath("Album/./../Song.mp3")).toBe("Song.mp3");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeM3uPath("  Album/song.mp3  ")).toBe("Album/song.mp3");
  });
});

describe("m3uBaseName", () => {
  it("returns the last segment", () => {
    expect(m3uBaseName("Album/Sub/song.mp3")).toBe("song.mp3");
  });

  it("returns the whole value when there is no separator", () => {
    expect(m3uBaseName("song.mp3")).toBe("song.mp3");
  });
});

describe("parseM3u", () => {
  it("reads extended m3u entries in order", () => {
    const entries = parseM3u(
      [
        "#EXTM3U",
        "#EXTINF:210,Artist - Title",
        "Album/01 Song.mp3",
        "#EXTINF:180,Other",
        "song2.flac",
      ].join("\n"),
    );

    expect(entries).toEqual([
      {
        raw: "Album/01 Song.mp3",
        path: "Album/01 Song.mp3",
        title: "Artist - Title",
        duration: 210,
        group: undefined,
        isRemote: false,
      },
      {
        raw: "song2.flac",
        path: "song2.flac",
        title: "Other",
        duration: 180,
        group: undefined,
        isRemote: false,
      },
    ]);
  });

  it("parses a list that has no EXTM3U header", () => {
    const entries = parseM3u("song1.mp3\nsong2.mp3\n");
    expect(entries.map((entry) => entry.path)).toEqual([
      "song1.mp3",
      "song2.mp3",
    ]);
  });

  it("tolerates a byte order mark and crlf line endings", () => {
    const entries = parseM3u(
      "\uFEFF#EXTM3U\r\n#EXTINF:210,Title\r\ndir/song.mp3\r\n",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe("dir/song.mp3");
    expect(entries[0]?.title).toBe("Title");
  });

  it("skips comments and blank lines", () => {
    const entries = parseM3u(
      "#EXTM3U\n# a comment\n\n#EXTINF:5,T\nA.mp3\n\nB.mp3\n",
    );
    expect(entries.map((entry) => entry.path)).toEqual(["A.mp3", "B.mp3"]);
  });

  it("flags http and https locations as remote and leaves their path absolute", () => {
    const entries = parseM3u(
      "#EXTM3U\n#EXTINF:-1,Live\nhttp://stream.example/live\n",
    );
    expect(entries[0]?.isRemote).toBe(true);
    expect(entries[0]?.raw).toBe("http://stream.example/live");
  });

  it("normalizes a windows location written into the file", () => {
    const entries = parseM3u("#EXTM3U\n#EXTINF:1,T\nC:\\Music\\song.mp3\n");
    expect(entries[0]?.path).toBe("Music/song.mp3");
    expect(entries[0]?.isRemote).toBe(false);
  });

  it("reads a group directive into the entry", () => {
    const entries = parseM3u(
      "#EXTM3U\n#EXTINF:200,Title\n#EXTGRP:Rock\nA.mp3\n",
    );
    expect(entries[0]?.group).toBe("Rock");
  });
});

describe("serializeM3u", () => {
  it("round-trips through the parser", () => {
    const text = serializeM3u([
      {
        raw: "Album/01.mp3",
        path: "Album/01.mp3",
        title: "Artist - Title",
        duration: 210,
        isRemote: false,
      },
    ]);

    expect(text.startsWith("#EXTM3U")).toBe(true);
    const reparsed = parseM3u(text);
    expect(reparsed[0]?.path).toBe("Album/01.mp3");
    expect(reparsed[0]?.title).toBe("Artist - Title");
    expect(reparsed[0]?.duration).toBe(210);
  });

  it("omits the info directive when neither duration nor title is known", () => {
    const text = serializeM3u([
      {
        raw: "a.mp3",
        path: "a.mp3",
        duration: -1,
        isRemote: false,
      },
    ]);
    expect(text).toBe("#EXTM3U\na.mp3");
  });

  it("keeps a negative duration when a title is present", () => {
    const text = serializeM3u([
      {
        raw: "a.mp3",
        path: "a.mp3",
        title: "Untitled",
        duration: -1,
        isRemote: false,
      },
    ]);
    expect(text).toContain("#EXTINF:-1,Untitled");
  });

  it("drops entries without a location", () => {
    const text = serializeM3u([
      { raw: "", path: "", duration: -1, isRemote: false },
      { raw: "a.mp3", path: "a.mp3", duration: 5, isRemote: false },
    ]);
    expect(text).toContain("a.mp3");
    expect(text.match(/EXTINF/g)).toHaveLength(1);
  });
});

describe("playlistFileName", () => {
  it("appends the m3u extension", () => {
    expect(playlistFileName("Road Trip")).toBe("Road Trip.m3u");
  });

  it("replaces characters that are illegal in file names", () => {
    expect(playlistFileName('a/b:c*d?e"f<g>h|i')).toBe("a-b-c-d-e-f-g-h-i.m3u");
  });

  it("falls back to a default for an empty name", () => {
    expect(playlistFileName("   ")).toBe("playlist.m3u");
  });

  it("bounds the length of a very long name", () => {
    const name = playlistFileName("x".repeat(200));
    expect(name.length).toBeLessThanOrEqual(80 + ".m3u".length);
  });
});
