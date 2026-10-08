export type DecodeCapability = "symphonia" | "flo" | "none";

export type MetadataCapability = "music-metadata" | "flo" | "none";

export interface HtmlAudioSupport {
  mime: string;
  minSafariVersion?: number;
}

export interface AudioFormat {
  id: string;
  label: string;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  decode: DecodeCapability;
  metadata: MetadataCapability;
  htmlAudio: HtmlAudioSupport | null;
  lossless: boolean;
}

export const AUDIO_FORMATS: readonly AudioFormat[] = [
  {
    id: "flo",
    label: "Flo",
    extensions: [".flo"],
    mimeTypes: ["audio/x-flo"],
    decode: "flo",
    metadata: "flo",
    htmlAudio: null,
    lossless: true,
  },
  {
    id: "mp3",
    label: "MP3",
    extensions: [".mp3"],
    mimeTypes: ["audio/mpeg", "audio/mp3"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: "audio/mpeg" },
    lossless: false,
  },
  {
    id: "aac",
    label: "AAC",
    extensions: [".aac"],
    mimeTypes: ["audio/aac", "audio/aacp"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: "audio/aac" },
    lossless: false,
  },
  {
    id: "mp4",
    label: "AAC/ALAC in MP4",
    extensions: [".m4a", ".m4b", ".mp4", ".m4p"],
    mimeTypes: ["audio/mp4", "audio/x-m4a", "video/mp4"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: 'audio/mp4; codecs="mp4a.40.2"' },
    lossless: false,
  },
  {
    id: "alac",
    label: "Apple Lossless (ALAC)",
    extensions: [".alac"],
    mimeTypes: ["audio/x-alac", "audio/alac"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: 'audio/mp4; codecs="alac"' },
    lossless: true,
  },
  {
    id: "flac",
    label: "FLAC",
    extensions: [".flac"],
    mimeTypes: ["audio/flac", "audio/x-flac"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: "audio/flac", minSafariVersion: 11 },
    lossless: true,
  },
  {
    id: "wav",
    label: "WAV",
    extensions: [".wav", ".wave"],
    mimeTypes: ["audio/wav", "audio/wave", "audio/x-wav"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: "audio/wav" },
    lossless: true,
  },
  {
    id: "aiff",
    label: "AIFF",
    extensions: [".aif", ".aiff", ".aifc"],
    mimeTypes: ["audio/aiff", "audio/x-aiff"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: "audio/aiff" },
    lossless: true,
  },
  {
    id: "caf",
    label: "Core Audio Format",
    extensions: [".caf"],
    mimeTypes: ["audio/x-caf"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: "audio/x-caf" },
    lossless: true,
  },
  {
    id: "ogg-vorbis",
    label: "Ogg Vorbis",
    extensions: [".ogg", ".oga"],
    mimeTypes: ["audio/ogg", "audio/vorbis", "application/ogg"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: { mime: "audio/ogg; codecs=vorbis", minSafariVersion: 18.4 },
    lossless: false,
  },
  {
    id: "matroska",
    label: "Matroska audio",
    extensions: [".mka", ".mkv"],
    mimeTypes: ["audio/x-matroska", "video/x-matroska"],
    decode: "symphonia",
    metadata: "music-metadata",
    htmlAudio: null,
    lossless: false,
  },
  {
    id: "opus",
    label: "Opus",
    extensions: [".opus"],
    mimeTypes: ["audio/opus", "audio/ogg; codecs=opus"],
    decode: "none",
    metadata: "music-metadata",
    htmlAudio: { mime: "audio/ogg; codecs=opus", minSafariVersion: 18.4 },
    lossless: false,
  },
] as const;

export const UNPLAYABLE_FORMATS: readonly AudioFormat[] = [
  {
    id: "wavpack",
    label: "WavPack",
    extensions: [".wv"],
    mimeTypes: ["audio/x-wavpack"],
    decode: "none",
    metadata: "music-metadata",
    htmlAudio: null,
    lossless: true,
  },
  {
    id: "musepack",
    label: "Musepack",
    extensions: [".mpc"],
    mimeTypes: ["audio/x-musepack", "audio/musepack"],
    decode: "none",
    metadata: "music-metadata",
    htmlAudio: null,
    lossless: false,
  },
  {
    id: "dsd",
    label: "DSD",
    extensions: [".dsf", ".dff"],
    mimeTypes: ["audio/x-dsd", "audio/dsd"],
    decode: "none",
    metadata: "music-metadata",
    htmlAudio: null,
    lossless: true,
  },
  {
    id: "wma",
    label: "Windows Media Audio",
    extensions: [".wma", ".asf"],
    mimeTypes: ["audio/x-ms-wma", "video/x-ms-asf"],
    decode: "none",
    metadata: "music-metadata",
    htmlAudio: null,
    lossless: false,
  },
  {
    id: "realaudio",
    label: "RealAudio",
    extensions: [".ra", ".ram"],
    mimeTypes: ["audio/x-realaudio", "audio/vnd.real.audio", "audio/realaudio"],
    decode: "none",
    metadata: "none",
    htmlAudio: null,
    lossless: false,
  },
  {
    id: "ac3",
    label: "Dolby Digital AC-3",
    extensions: [".ac3"],
    mimeTypes: ["audio/ac3"],
    decode: "none",
    metadata: "none",
    htmlAudio: null,
    lossless: false,
  },
] as const;

const ALL_FORMATS: readonly AudioFormat[] = [
  ...AUDIO_FORMATS,
  ...UNPLAYABLE_FORMATS,
];

const BY_EXTENSION = new Map<string, AudioFormat>();
const BY_ID = new Map<string, AudioFormat>();

const BY_MIME_EXACT = new Map<string, AudioFormat>();
const BY_MIME_BASE = new Map<string, AudioFormat>();

for (const format of ALL_FORMATS) {
  BY_ID.set(format.id, format);
  for (const extension of format.extensions) {
    if (!BY_EXTENSION.has(extension)) BY_EXTENSION.set(extension, format);
  }
  for (const mime of format.mimeTypes) {
    const exact = mime.trim().toLowerCase();
    if (!BY_MIME_EXACT.has(exact)) BY_MIME_EXACT.set(exact, format);
    const base = normalizeMime(exact);
    if (base !== exact && !BY_MIME_BASE.has(base))
      BY_MIME_BASE.set(base, format);
  }
}

export function importableFormats(): readonly AudioFormat[] {
  return ALL_FORMATS.filter(
    (format) => format.decode !== "none" || format.metadata !== "none",
  );
}

export function importableExtensions(): readonly string[] {
  return importableFormats().flatMap((format) => [...format.extensions]);
}

export function importableExtensionNames(): readonly string[] {
  return importableExtensions().map((extension) => extension.slice(1));
}

export function importablePathPattern(): RegExp {
  const escaped = importableExtensionNames().map((extension) =>
    extension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  return new RegExp(`\\.(?:${escaped.join("|")})$`, "i");
}

export function getFormatById(id: string): AudioFormat | undefined {
  return BY_ID.get(id);
}

export function getFormatByCodec(codec: string): AudioFormat | undefined {
  const normalized = codec.trim().toLowerCase();
  if (!normalized) return undefined;

  const byId = BY_ID.get(normalized);
  if (byId) return byId;

  const byExtension = BY_EXTENSION.get(`.${normalized}`);
  if (byExtension) return byExtension;

  for (const format of ALL_FORMATS) {
    if (format.extensions.some((ext) => ext.slice(1) === normalized)) {
      return format;
    }
  }

  return undefined;
}

export function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "";
  return fileName.slice(lastDot).toLowerCase();
}

export function fileExtensionLabel(
  fileName: string | undefined,
): string | undefined {
  if (!fileName) return undefined;
  const bare = extensionOf(fileName).slice(1);
  return bare ? bare.toUpperCase() : undefined;
}

export function normalizeMime(mimeType: string): string {
  const semicolon = mimeType.indexOf(";");
  const base = semicolon < 0 ? mimeType : mimeType.slice(0, semicolon);
  return base.trim().toLowerCase();
}

export function identifyFormat(
  fileName: string,
  mimeType: string,
  codecHint?: string,
): AudioFormat | undefined {
  if (codecHint) {
    const byCodec = getFormatByCodec(codecHint);
    if (byCodec) return byCodec;
  }

  const extension = extensionOf(fileName);
  if (extension) {
    const byExtension = BY_EXTENSION.get(extension);
    if (byExtension) return byExtension;
  }

  const exact = mimeType.trim().toLowerCase();
  if (exact) {
    const byExact = BY_MIME_EXACT.get(exact);
    if (byExact) return byExact;

    const byBase = BY_MIME_BASE.get(normalizeMime(exact));
    if (byBase) return byBase;
  }

  return undefined;
}

export function isKnownFormat(format: AudioFormat | undefined): boolean {
  return format !== undefined;
}
