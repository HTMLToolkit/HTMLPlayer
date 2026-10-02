import type { Playlist, Track } from "../../core/engine/types";
import { serializeM3u, type M3uEntry } from "../library/m3u";

function playlistTrackPath(track: Track): string | null {
  if (track.sourceKind === "folderHandle" && track.path) {
    return track.path;
  }
  if (track.url && !track.url.startsWith("blob:")) {
    return track.url;
  }
  return null;
}

export interface M3uExportResult {
  text: string;
  entryCount: number;
  skipped: Array<{ id: string; name: string; reason: "noLocation" }>;
}

export function commonFolderSourceId(playlist: Playlist): string | null {
  const sourceIds = new Set<string>();
  for (const track of playlist.songs) {
    if (track.sourceKind !== "folderHandle" || !track.sourceId) continue;
    sourceIds.add(track.sourceId);
  }
  if (sourceIds.size !== 1) return null;
  for (const sourceId of sourceIds) return sourceId;
  return null;
}

export function exportPlaylistToM3u(playlist: Playlist): M3uExportResult {
  const entries: M3uEntry[] = [];
  const skipped: M3uExportResult["skipped"] = [];

  for (const track of playlist.songs) {
    const location = playlistTrackPath(track);
    if (!location) {
      skipped.push({ id: track.id, name: track.title, reason: "noLocation" });
      continue;
    }
    entries.push({
      raw: location,
      path: location,
      title: `${track.artist ? `${track.artist} - ` : ""}${track.title}`.trim(),
      duration: track.duration ?? -1,
      isRemote: /^https?:\/\//i.test(location),
    });
  }

  return { text: serializeM3u(entries), entryCount: entries.length, skipped };
}
