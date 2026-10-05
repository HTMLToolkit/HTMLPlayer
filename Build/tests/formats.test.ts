import {
  AUDIO_FORMATS,
  UNPLAYABLE_FORMATS,
  classifyImportFile,
  fileExtensionLabel,
  getFormatById,
  identifyFormat,
  importableExtensionNames,
  importableExtensions,
  importableFormats,
  importablePathPattern,
  isImportableFile,
  resolveSupport,
} from "../src/platform/audio/formats";
import { SUPPORTED_AUDIO_RE } from "../src/platform/storage/directoryHandle";
import { describe, it, expect } from "@jest/globals";

describe("format registry", () => {
  it("keys on extension ahead of MIME type", () => {
    expect(identifyFormat("track.ra", "audio/x-realaudio").id).toBe(
      "realaudio",
    );
    expect(identifyFormat("track.ra", "").id).toBe("realaudio");
  });

  it("resolves every format row by id, extension and MIME type", () => {
    for (const format of AUDIO_FORMATS) {
      expect(getFormatById(format.id)).toBe(format);
      for (const extension of format.extensions) {
        expect(identifyFormat(`track.${extension}`, "")).toBe(format);
      }
      for (const mimeType of format.mimeTypes) {
        expect(identifyFormat("track.bin", mimeType)).toBe(format);
      }
    }
  });

  it("prefers an exact codec-qualified MIME over its base type", () => {
    expect(identifyFormat("track.bin", "audio/ogg; codecs=opus")?.id).toBe(
      "opus",
    );
    expect(identifyFormat("track.bin", "audio/ogg")?.id).toBe("ogg-vorbis");
  });

  it("gives every format a unique id", () => {
    const ids = AUDIO_FORMATS.map((format) => format.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not map one extension to two formats", () => {
    const seen = new Map<string, string>();
    for (const format of AUDIO_FORMATS) {
      for (const extension of format.extensions) {
        const key = extension.toLowerCase();
        const existing = seen.get(key);
        expect(existing).toBeUndefined();
        seen.set(key, format.id);
      }
    }
  });
});

describe("fileExtensionLabel", () => {
  it("uppercases the trailing extension without its dot", () => {
    expect(fileExtensionLabel("Sample.opus")).toBe("OPUS");
    expect(fileExtensionLabel("sample.M4A")).toBe("M4A");
  });

  it("uses only the final extension of a multi-dot name", () => {
    expect(fileExtensionLabel("archive.tar.gz")).toBe("GZ");
  });

  it("returns undefined when the name carries no extension", () => {
    expect(fileExtensionLabel("track")).toBeUndefined();
    expect(fileExtensionLabel("")).toBeUndefined();
    expect(fileExtensionLabel(undefined)).toBeUndefined();
  });

  it("reports a trailing dot as no extension", () => {
    expect(fileExtensionLabel("track.")).toBeUndefined();
  });
});

describe("resolveSupport", () => {
  const supported = (name: string, mimeType = "", hasStoredAudio = true) =>
    resolveSupport(name, mimeType, { hasStoredAudio, isSafariRuntime: false });

  it("rejects extensions no format claims", () => {
    const verdict = supported("cover.jpg", "image/jpeg");
    expect(verdict.status).toBe("unrecognized");
  });

  it("rejects the sample3 files that reached the parser unfiltered", () => {
    for (const name of ["sample3.sou", "sample3.dvms", "sample3.ra"]) {
      expect(supported(name, "audio/x-realaudio").status).toBe("unplayable");
    }
  });

  it("keeps the metadata axis independent of the decode axis", () => {
    for (const format of AUDIO_FORMATS) {
      if (format.decode === "none") continue;
      const verdict = supported(`track.${format.extensions[0]}`);
      expect(verdict.status).toBe("supported");
    }

    for (const format of AUDIO_FORMATS.filter(
      (candidate) => candidate.metadata === "none",
    )) {
      expect(format.decode).not.toBe("none");
    }
  });

  it("reads Matroska tags through music-metadata", () => {
    expect(getFormatById("matroska")?.metadata).toBe("music-metadata");
  });

  it("has no tag reader for RealAudio", () => {
    expect(getFormatById("realaudio")?.metadata).toBe("none");
  });

  it("reports why a known format cannot play", () => {
    const verdict = supported("track.ra", "audio/x-realaudio");
    if (verdict.status !== "unplayable") throw new Error("expected unplayable");
    expect(verdict.format.id).toBe("realaudio");
    expect(verdict.reason).toMatch(/not playable|browser/i);
  });

  it("marks formats no backend decodes as unplayable even with stored audio", () => {
    for (const format of AUDIO_FORMATS.filter(
      (candidate) => candidate.decode === "none",
    )) {
      const verdict = supported(`track.${format.extensions[0]}`);
      expect(verdict.status).toBe("unplayable");
    }
  });

  it("supports ALAC through stored audio even when the element cannot decode it", () => {
    expect(supported("track.m4a").status).toBe("supported");
  });

  it("gates Ogg Vorbis on Safari 18.4 even when the element claims support", () => {
    const originalCreateElement = document.createElement.bind(document);
    const originalUserAgent = navigator.userAgent;

    document.createElement = (tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === "audio") {
        Object.defineProperty(element, "canPlayType", {
          value: () => "probably",
        });
      }
      return element;
    };
    Object.defineProperty(navigator, "userAgent", {
      value: `Mozilla/5.0 AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15`,
      configurable: true,
    });

    try {
      const before = resolveSupport("track.ogg", "audio/ogg", {
        hasStoredAudio: true,
        isSafariRuntime: true,
      });
      expect(before.status).toBe("unplayable");
      if (before.status === "unplayable") {
        expect(before.reason).toContain("18.4");
      }

      Object.defineProperty(navigator, "userAgent", {
        value: `Mozilla/5.0 AppleWebKit/605.1.15 Version/18.4 Safari/605.1.15`,
        configurable: true,
      });

      const after = resolveSupport("track.ogg", "audio/ogg", {
        hasStoredAudio: true,
        isSafariRuntime: true,
      });
      expect(after.status).toBe("supported");
    } finally {
      document.createElement = originalCreateElement;
      Object.defineProperty(navigator, "userAgent", {
        value: originalUserAgent,
        configurable: true,
      });
    }
  });

  it("never reports an unknown extension as unplayable", () => {
    const verdict = supported("mystery.xyz");
    expect(verdict.status).toBe("unrecognized");
  });
});
describe("importable lists", () => {
  it("offers every format the app can decode or tag", () => {
    const offered = new Set(importableFormats().map((format) => format.id));
    for (const format of AUDIO_FORMATS)
      expect(offered.has(format.id)).toBe(true);
    for (const format of UNPLAYABLE_FORMATS) {
      const useful = format.decode !== "none" || format.metadata !== "none";
      expect(offered.has(format.id)).toBe(useful);
    }
  });

  it("excludes formats that are neither decodable nor taggable", () => {
    expect(importableExtensions()).not.toContain(".ra");
    expect(importableFormats().some((f) => f.id === "realaudio")).toBe(false);
  });

  it("classifies WMA as recognized rather than unknown", () => {
    const verdict = resolveSupport("sample3.wma", "", {
      hasStoredAudio: true,
      isSafariRuntime: false,
    });
    expect(verdict.status).toBe("unplayable");
    if (verdict.status === "unplayable") {
      expect(verdict.format.id).toBe("wma");
      expect(verdict.metadataOnly).toBe(true);
    }
  });

  it("derives the extension names the native dialog needs", () => {
    expect(importableExtensionNames()).toContain("mp3");
    for (const name of importableExtensionNames()) {
      expect(name).not.toContain(".");
      expect(importableExtensions()).toContain(`.${name}`);
    }
  });

  it("matches directory paths on importable extensions only", () => {
    const pattern = importablePathPattern();
    expect(pattern.test("Album/01 Track.mp3")).toBe(true);
    expect(pattern.test("Album/01 Track.MP3")).toBe(true);
    expect(pattern.test("Nested/dir/track.caf")).toBe(true);
    expect(pattern.test("cover.jpg")).toBe(false);
    expect(pattern.test("archive.zip")).toBe(false);
    expect(pattern.test("track.mp3.txt")).toBe(false);
  });

  it("gates imports through the shared policy entry point", () => {
    for (const format of AUDIO_FORMATS) {
      const file = new File(
        [new Uint8Array([0])],
        `track.${format.extensions[0]}`,
      );
      const expected = format.decode !== "none";
      expect(isImportableFile(file)).toBe(expected);
    }
  });

  it("refuses recognized formats that cannot be played", () => {
    const realaudio = new File([new Uint8Array([0])], "track.ra");
    expect(classifyImportFile(realaudio).status).toBe("unplayable");
    expect(isImportableFile(realaudio)).toBe(false);
  });

  it("keeps the directory walker in step with the registry", () => {
    expect(SUPPORTED_AUDIO_RE.source).toBe(importablePathPattern().source);
  });
});
