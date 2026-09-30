import type { Playlist, Track } from "../../core/engine/types";
import { generateUniqueId } from "../metadata";
import { parseM3u, type M3uEntry } from "../library/m3u";
import {
  importAudioFiles,
  type Translate,
} from "../../helpers/importAudioFiles";
import { storeImportedSong, storeRemoteSong } from "../../helpers/addSong";
import {
  ensureReadPermission,
  resolveFileAtPath,
  type FsDirectoryHandle,
} from "./directoryHandle";
import {
  directoryStore,
  reindexDirectory,
  upsertDirectory,
} from "./directoryStore";
import {
  matchM3uEntries,
  planM3uImport,
  type M3uMatchMode,
  type M3uUnresolvedEntry,
} from "./m3uImport";

export interface M3uImportOutcome {
  playlistId: string;
  directoryId?: string;
  name: string;
  added: number;
  reused: number;
  remote: number;
  fallbacks: number;
  unresolved: M3uUnresolvedEntry[];
}

export type M3uImportResult =
  | { status: "imported"; outcome: M3uImportOutcome }
  | { status: "cancelled" }
  | { status: "failed"; reason: "empty" | "permission"; directoryName?: string }
  | { status: "failed"; reason: "error"; message: string };

export interface M3uImportDeps {
  getTracks: () => Track[];
  addTrack: (track: Track) => void;
  addPlaylist: (playlist: Playlist) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  pickBaseDirectory: () => Promise<FsDirectoryHandle | null>;
  t: Translate;
}

function remoteTrack(url: string, entry: M3uEntry): Track {
  const label = entry.title?.trim() || entry.path.split("/").pop() || url;
  const separator = label.indexOf(" - ");
  const artist = separator > 0 ? label.slice(0, separator).trim() : "";
  const title = separator > 0 ? label.slice(separator + 3).trim() : label;

  return {
    id: generateUniqueId(),
    title: title || label,
    artist: artist || "Unknown Artist",
    album: entry.group ?? "Unknown Album",
    duration: entry.duration >= 0 ? entry.duration : 0,
    url,
    hasStoredAudio: false,
  };
}

function playlistName(fileName: string): string {
  return fileName.replace(/\.m3u8?$/i, "");
}

export async function runM3uImport(
  file: File,
  mode: M3uMatchMode,
  deps: M3uImportDeps,
): Promise<M3uImportResult> {
  try {
    const entries = parseM3u(await file.text());
    if (entries.length === 0) return { status: "failed", reason: "empty" };

    let handle: FsDirectoryHandle | null = null;
    if (entries.some((entry) => !entry.isRemote)) {
      handle = await deps.pickBaseDirectory();
      if (!handle) return { status: "cancelled" };
      if (!(await ensureReadPermission(handle))) {
        return {
          status: "failed",
          reason: "permission",
          directoryName: handle.name ?? "",
        };
      }
    }

    const matched = handle
      ? await matchM3uEntries(entries, handle, mode)
      : {
          resolutions: entries.map((entry) => ({
            kind: "remote" as const,
            url: entry.raw,
          })),
          fallbacks: 0,
          scanned: false,
        };

    const plan = planM3uImport(entries, matched, deps.getTracks);
    const record = handle
      ? await upsertDirectory(handle.name ?? file.name, handle)
      : null;
    const directoryId = record?.id;

    const imported = new Map<string, Track>();
    let added = 0;
    let duplicates = 0;
    if (plan.files.length > 0 && record) {
      const result = await importAudioFiles(
        plan.files.map((match) => ({ file: match.file, path: match.path })),
        async (song, audioFile, context) => {
          await storeImportedSong(song, audioFile, context);
          deps.addTrack(song);
        },
        deps.t,
        deps.getTracks,
        { sourceKind: "folderHandle", sourceId: record.id },
      );

      result.songs.forEach((song, index) => {
        const match = plan.files[index];
        if (song && match) imported.set(match.path, song);
      });
      added = result.successCount;
      duplicates = result.duplicateCount;

      await reindexDirectory(record.id, deps.getTracks());
    }

    const songs: Track[] = [];
    for (const slot of plan.slots) {
      if (slot.kind === "existing") {
        songs.push(slot.track);
        continue;
      }
      if (slot.kind === "file") {
        const song = imported.get(slot.match.path);
        if (song) songs.push(song);
        continue;
      }
      const known = deps.getTracks().find((track) => track.url === slot.url);
      if (known) {
        songs.push(known);
        continue;
      }
      const created = await storeRemoteSong(remoteTrack(slot.url, slot.entry));
      deps.addTrack(created);
      songs.push(created);
    }

    const playlist: Playlist = {
      id: generateUniqueId(),
      name: playlistName(file.name),
      songs,
    };
    deps.addPlaylist(playlist);

    return {
      status: "imported",
      outcome: {
        playlistId: playlist.id,
        directoryId,
        name: playlist.name,
        added,
        reused:
          plan.slots.filter((slot) => slot.kind === "existing").length +
          duplicates,
        remote: plan.remote.length,
        fallbacks: plan.fallbacks,
        unresolved: plan.unresolved,
      },
    };
  } catch (error) {
    return {
      status: "failed",
      reason: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function remapM3uEntry(
  outcome: M3uImportOutcome,
  candidatePath: string,
  deps: M3uImportDeps,
): Promise<boolean> {
  if (!outcome.directoryId) return false;

  const record = await directoryStore.get(outcome.directoryId);
  const handle = record?.handle as FsDirectoryHandle | undefined;
  if (!handle) return false;

  const file = await resolveFileAtPath(handle, candidatePath);
  if (!file) return false;

  const result = await importAudioFiles(
    [{ file, path: candidatePath }],
    async (song, audioFile, context) => {
      await storeImportedSong(song, audioFile, context);
      deps.addTrack(song);
    },
    deps.t,
    deps.getTracks,
    { sourceKind: "folderHandle", sourceId: outcome.directoryId },
  );

  const song = result.songs[0];
  if (!song) return false;

  deps.addToPlaylist(outcome.playlistId, song);
  await reindexDirectory(outcome.directoryId, deps.getTracks());
  return true;
}
