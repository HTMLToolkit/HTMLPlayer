import type { Track } from "../../core/engine/types";
import {
  buildDirectoryIndex,
  ensureReadPermission,
  resolveFileAtPath,
  type DirectoryIndex,
  type FsDirectoryHandle,
} from "./directoryHandle";
import { m3uBaseName, normalizeM3uPath, type M3uEntry } from "../library/m3u";

export type M3uMatchMode = "auto" | "path" | "filename";

export type M3uResolution =
  | { kind: "path"; file: File; path: string }
  | { kind: "name"; file: File; path: string }
  | { kind: "remote"; url: string }
  | { kind: "missing" }
  | { kind: "ambiguous"; candidates: string[] };

export interface M3uMatchResult {
  resolutions: M3uResolution[];
  fallbacks: number;
  scanned: boolean;
}

function isAudioEntry(entry: M3uEntry): boolean {
  return !entry.isRemote && entry.path.length > 0;
}

export async function matchM3uEntries(
  entries: M3uEntry[],
  handle: FsDirectoryHandle,
  mode: M3uMatchMode,
): Promise<M3uMatchResult> {
  const resolutions: M3uResolution[] = new Array(entries.length);
  let index: DirectoryIndex | null = null;
  let fallbacks = 0;
  let scanned = false;

  const buildIndex = async (): Promise<DirectoryIndex> => {
    if (index) return index;
    scanned = true;
    index = await buildDirectoryIndex(handle);
    return index;
  };

  for (const [position, entry] of entries.entries()) {
    if (entry.isRemote) {
      resolutions[position] = { kind: "remote", url: entry.raw };
      continue;
    }
    if (!isAudioEntry(entry)) {
      resolutions[position] = { kind: "missing" };
      continue;
    }

    if (mode !== "filename") {
      const direct = await resolveFileAtPath(handle, entry.path);
      if (direct) {
        resolutions[position] = {
          kind: "path",
          file: direct,
          path: entry.path,
        };
        continue;
      }
      if (mode === "path") {
        resolutions[position] = { kind: "missing" };
        continue;
      }
    }

    const candidates =
      (await buildIndex()).byName.get(m3uBaseName(entry.path).toLowerCase()) ??
      [];
    const only = candidates.length === 1 ? candidates[0] : undefined;
    if (only) {
      if (mode === "auto") fallbacks++;
      resolutions[position] = {
        kind: "name",
        file: only.file,
        path: only.relativePath,
      };
      continue;
    }
    resolutions[position] =
      candidates.length > 1
        ? {
            kind: "ambiguous",
            candidates: candidates.map((c) => c.relativePath),
          }
        : { kind: "missing" };
  }

  return { resolutions, fallbacks, scanned };
}

export interface M3uFileMatch {
  file: File;
  path: string;
  entry: M3uEntry;
  matchedBy: "path" | "name";
}

export interface M3uUnresolvedEntry {
  entry: M3uEntry;
  reason: "missing" | "ambiguous";
  candidates: string[];
}

export type M3uSlot =
  | { kind: "file"; match: M3uFileMatch }
  | { kind: "remote"; url: string; entry: M3uEntry }
  | { kind: "existing"; track: Track };

export interface M3uImportPlan {
  slots: M3uSlot[];
  files: M3uFileMatch[];
  remote: Array<{ url: string; entry: M3uEntry }>;
  unresolved: M3uUnresolvedEntry[];
  fallbacks: number;
  scanned: boolean;
}

export function planM3uImport(
  entries: M3uEntry[],
  result: M3uMatchResult,
  getExistingTracks: () => Track[],
): M3uImportPlan {
  const known = new Map<string, Track>();
  for (const track of getExistingTracks()) {
    if (track.sourceKind === "folderHandle" && track.path) {
      known.set(normalizeM3uPath(track.path), track);
    }
  }

  const slots: M3uSlot[] = [];
  const remote: Array<{ url: string; entry: M3uEntry }> = [];
  const unresolved: M3uUnresolvedEntry[] = [];
  const claimed = new Set<string>();

  entries.forEach((entry, position) => {
    const resolution = result.resolutions[position];
    if (!resolution) return;
    if (resolution.kind === "missing" || resolution.kind === "ambiguous") {
      unresolved.push({
        entry,
        reason: resolution.kind,
        candidates:
          resolution.kind === "ambiguous" ? resolution.candidates : [],
      });
      return;
    }
    if (resolution.kind === "remote") {
      slots.push({ kind: "remote", url: resolution.url, entry });
      remote.push({ url: resolution.url, entry });
      return;
    }

    const path = normalizeM3uPath(resolution.path);
    if (claimed.has(path)) return;
    claimed.add(path);

    const match: M3uFileMatch = {
      file: resolution.file,
      path,
      entry,
      matchedBy: resolution.kind,
    };
    const existing = known.get(path);
    if (existing) {
      slots.push({ kind: "existing", track: existing });
    } else {
      slots.push({ kind: "file", match });
    }
  });

  return {
    slots,
    files: slots.flatMap((slot) => (slot.kind === "file" ? [slot.match] : [])),
    remote,
    unresolved,
    fallbacks: result.fallbacks,
    scanned: result.scanned,
  };
}

export { ensureReadPermission as ensureM3uDirectoryPermission };
