import type { SessionState } from "./utils/session";
import type { RepeatMode, SettingsState, ThemeMode } from "./settings/types";
import {
  isPlainObject,
  isRepeatMode,
} from "../core/engine/validators";

const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "auto"];

function isThemeMode(value: unknown): value is ThemeMode {
  return (
    typeof value === "string" &&
    (THEME_MODES as readonly string[]).includes(value)
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Merges a raw JSON settings blob over defaults, accepting only fields whose
 * runtime shape matches the SettingsState contract. Corrupt or stale fields
 * from a previous schema are silently dropped in favor of defaults.
 */
export function sanitizeSettingsState(
  raw: unknown,
  defaults: SettingsState,
): SettingsState {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ...defaults };
  }

  const candidate = raw as Record<string, unknown>;
  const repeat = candidate.defaultRepeat;

  return {
    ...defaults,
    volume: isFiniteNumber(candidate.volume)
      ? Math.min(1, Math.max(0, candidate.volume))
      : defaults.volume,
    crossfade: isFiniteNumber(candidate.crossfade)
      ? candidate.crossfade
      : defaults.crossfade,
    crossfadeBeforeGapless: isFiniteNumber(candidate.crossfadeBeforeGapless)
      ? candidate.crossfadeBeforeGapless
      : defaults.crossfadeBeforeGapless,
    colorTheme: isString(candidate.colorTheme)
      ? candidate.colorTheme
      : defaults.colorTheme,
    wallpaper: isString(candidate.wallpaper)
      ? candidate.wallpaper
      : defaults.wallpaper,
    defaultShuffle: isBoolean(candidate.defaultShuffle)
      ? candidate.defaultShuffle
      : defaults.defaultShuffle,
    defaultRepeat: isRepeatMode(repeat) ? repeat : defaults.defaultRepeat,
    autoPlayNext: isBoolean(candidate.autoPlayNext)
      ? candidate.autoPlayNext
      : defaults.autoPlayNext,
    themeMode: isThemeMode(candidate.themeMode)
      ? candidate.themeMode
      : defaults.themeMode,
    compactMode: isBoolean(candidate.compactMode)
      ? candidate.compactMode
      : defaults.compactMode,
    showAlbumArt: isBoolean(candidate.showAlbumArt)
      ? candidate.showAlbumArt
      : defaults.showAlbumArt,
    showLyrics: isBoolean(candidate.showLyrics)
      ? candidate.showLyrics
      : defaults.showLyrics,
    sessionRestore: isBoolean(candidate.sessionRestore)
      ? candidate.sessionRestore
      : defaults.sessionRestore,
    lastPlayedSongId: isString(candidate.lastPlayedSongId)
      ? candidate.lastPlayedSongId
      : defaults.lastPlayedSongId,
    lastPlayedPlaylistId: isString(candidate.lastPlayedPlaylistId)
      ? candidate.lastPlayedPlaylistId
      : defaults.lastPlayedPlaylistId,
    language: isString(candidate.language)
      ? candidate.language
      : defaults.language,
    tempo: isFiniteNumber(candidate.tempo) ? candidate.tempo : defaults.tempo,
    pitch: isFiniteNumber(candidate.pitch) ? candidate.pitch : defaults.pitch,
    gaplessPlayback: isBoolean(candidate.gaplessPlayback)
      ? candidate.gaplessPlayback
      : defaults.gaplessPlayback,
    smartShuffle: isBoolean(candidate.smartShuffle)
      ? candidate.smartShuffle
      : defaults.smartShuffle,
    discordUserId: isString(candidate.discordUserId)
      ? candidate.discordUserId
      : defaults.discordUserId,
    discordEnabled: isBoolean(candidate.discordEnabled)
      ? candidate.discordEnabled
      : defaults.discordEnabled,
    erudaEnabled: isBoolean(candidate.erudaEnabled)
      ? candidate.erudaEnabled
      : defaults.erudaEnabled,
  };
}

/**
 * Merges a raw JSON session blob over the fallback session, keeping only
 * fields that match the SessionState contract.
 */
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
      ? Math.min(1, Math.max(0, candidate.volume))
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

/**
 * Reads the value out of a versioned envelope, but only when the stored
 * schemaVersion matches the current one. Mismatched or unversioned payloads
 * (i.e. anything written before versioning existed) fall back.
 */
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