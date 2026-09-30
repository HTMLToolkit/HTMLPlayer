import {
  M3uGenerator,
  M3uParser,
  M3uPlaylist,
  M3uMedia,
} from "m3u-parser-generator";

export interface M3uEntry {
  raw: string;
  path: string;
  title?: string;
  duration: number;
  group?: string;
  isRemote: boolean;
}

const REMOTE_SCHEME = /^https?:\/\//i;
const FILE_SCHEME = /^file:\/\//i;
const DRIVE_LETTER = /^\/?[a-z]:[\\/]/i;
const BOM = "\uFEFF";

export function normalizeM3uPath(raw: string): string {
  let value = raw.trim();
  if (FILE_SCHEME.test(value)) {
    try {
      value = decodeURIComponent(new URL(value).pathname);
    } catch {
      value = value.replace(FILE_SCHEME, "");
    }
  } else {
    value = value.split("#")[0] ?? "";
  }
  if (DRIVE_LETTER.test(value)) {
    value = value.slice(value.charAt(0) === "/" ? 3 : 2);
  }
  value = value.replace(/\\/g, "/");
  const segments: string[] = [];
  for (const segment of value.split("/")) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

export function m3uBaseName(normalizedPath: string): string {
  const segments = normalizedPath.split("/");
  return segments[segments.length - 1] ?? "";
}

export function parseM3u(text: string): M3uEntry[] {
  const playlist = new M3uParser({ ignoreErrors: true }).parse(text);
  const entries: M3uEntry[] = [];
  for (const media of playlist.medias) {
    const raw = media.location?.trim();
    if (!raw) continue;
    entries.push({
      raw,
      path: normalizeM3uPath(raw),
      title: media.name,
      duration: media.duration,
      group: media.group,
      isRemote: REMOTE_SCHEME.test(raw),
    });
  }
  return entries;
}

export function serializeM3u(entries: M3uEntry[]): string {
  const playlist = new M3uPlaylist();
  for (const entry of entries) {
    if (!entry.path) continue;
    const media = new M3uMedia(entry.path);
    media.duration = entry.duration >= 0 ? entry.duration : -1;
    if (entry.title) media.name = entry.title;
    if (entry.group) media.group = entry.group;
    playlist.medias.push(media);
  }
  return M3uGenerator.generate(playlist);
}

export function playlistFileName(name: string): string {
  const safe = name
    .trim()
    .replace(BOM, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
  return `${safe.length > 0 ? safe : "playlist"}.m3u`;
}
