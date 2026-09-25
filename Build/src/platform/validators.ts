import type { SessionState } from "./utils/session";
import type { RepeatMode } from "./settings/types";
import { isPlainObject, isRepeatMode } from "../core/engine/validators";
import { clampVolume } from "./audio/clamp";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function sanitizeSessionState(
  raw: unknown,
  fallback: SessionState,
): SessionState {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ...fallback };
  }

  const candidate = raw as Record<string, unknown>;
  const lastPlayedSongId = candidate.lastPlayedSongId;
  const lastPlayedPlaylistId = candidate.lastPlayedPlaylistId;

  return {
    lastPlayedSongId:
      lastPlayedSongId === null || isString(lastPlayedSongId)
        ? lastPlayedSongId
        : fallback.lastPlayedSongId,
    lastPlayedPlaylistId:
      lastPlayedPlaylistId === null || isString(lastPlayedPlaylistId)
        ? lastPlayedPlaylistId
        : fallback.lastPlayedPlaylistId,
    lastPosition: isFiniteNumber(candidate.lastPosition)
      ? candidate.lastPosition
      : fallback.lastPosition,
    volume: isFiniteNumber(candidate.volume)
      ? clampVolume(candidate.volume)
      : fallback.volume,
    shuffle: isBoolean(candidate.shuffle)
      ? candidate.shuffle
      : fallback.shuffle,
    repeat: isRepeatMode(candidate.repeat)
      ? (candidate.repeat as RepeatMode)
      : fallback.repeat,
    timestamp: isFiniteNumber(candidate.timestamp)
      ? candidate.timestamp
      : fallback.timestamp,
  };
}

export function sanitizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter(isString) : [];
}

export const SCHEMA_VERSION = 1;

export interface VersionedEnvelope<T> {
  schemaVersion: number;
  value: T;
}

export function withSchemaVersion<T>(value: T): VersionedEnvelope<T> {
  return { schemaVersion: SCHEMA_VERSION, value };
}

export function unwrapVersioned<T>(
  envelope: unknown,
  sanitize: (value: unknown) => T,
  fallback: T,
): T {
  if (!isPlainObject(envelope)) return fallback;
  if (envelope.schemaVersion !== SCHEMA_VERSION) return fallback;
  return sanitize(envelope.value);
}

export function serializeVersioned<T>(value: T): string {
  return JSON.stringify(withSchemaVersion(value));
}

export function deserializeVersionedJson(
  raw: string | null,
): VersionedEnvelope<unknown> | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    return { schemaVersion: parsed.schemaVersion, value: parsed.value };
  } catch {
    return null;
  }
}
