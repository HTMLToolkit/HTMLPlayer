import type {
  EngineSettings,
  Playlist,
  PlaylistItem,
  PlayHistory,
  QueueCursor,
  QueueState,
  RepeatMode,
  Track,
} from "./types";


export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isQueueCursorEmpty(
  cursor: QueueCursor,
): cursor is { kind: "empty" } {
  return cursor.kind === "empty";
}

export function isQueueCursorActive(
  cursor: QueueCursor,
): cursor is { kind: "active"; index: number } {
  return (
    cursor.kind === "active" &&
    typeof cursor.index === "number" &&
    Number.isInteger(cursor.index) &&
    cursor.index >= 0
  );
}

export function isQueueState(value: unknown): value is QueueState {
  if (!isPlainObject(value)) return false;
  if (!Array.isArray(value.tracks) || !value.tracks.every(isTrack)) {
    return false;
  }
  if (typeof value.shuffled !== "boolean") return false;
  if (
    !Array.isArray(value.shuffleOrder) ||
    !value.shuffleOrder.every((n) => typeof n === "number")
  ) {
    return false;
  }

  if (!isPlainObject(value.cursor)) return false;
  switch (value.cursor.kind) {
    case "empty":
      return true;
    case "active":
      return (
        typeof value.cursor.index === "number" &&
        value.cursor.index >= 0 &&
        value.cursor.index < value.tracks.length
      );
    default:
      return false;
  }
}

export function isTrack(value: unknown): value is Track {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    typeof value.album === "string" &&
    typeof value.duration === "number" &&
    typeof value.url === "string"
  );
}

export function isPlaylist(value: unknown): value is Playlist {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.songs) &&
    value.songs.every(isTrack)
  );
}

export function isPlaylistItem(value: unknown): value is PlaylistItem {
  if (isPlaylist(value)) return true;
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string" || typeof value.name !== "string") {
    return false;
  }
  return Array.isArray(value.children) && value.children.every(isPlaylistItem);
}

export function isPlayHistory(value: unknown): value is PlayHistory {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.trackId === "string" &&
    typeof value.lastPlayed === "number" &&
    typeof value.playCount === "number"
  );
}

const REPEAT_MODES: readonly RepeatMode[] = ["off", "one", "all"];

export function isRepeatMode(value: unknown): value is RepeatMode {
  return (
    typeof value === "string" &&
    (REPEAT_MODES as readonly string[]).includes(value)
  );
}

export function isEngineSettings(value: unknown): value is EngineSettings {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.volume === "number" &&
    typeof value.crossfade === "number" &&
    typeof value.crossfadeBeforeGapless === "number" &&
    typeof value.autoPlayNext === "boolean" &&
    typeof value.tempo === "number" &&
    typeof value.pitch === "number" &&
    typeof value.gaplessPlayback === "boolean" &&
    typeof value.smartShuffle === "boolean" &&
    isRepeatMode(value.repeat) &&
    typeof value.defaultShuffle === "boolean" &&
    isRepeatMode(value.defaultRepeat)
  );
}
