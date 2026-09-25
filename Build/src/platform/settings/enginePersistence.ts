import type { EngineSettings } from "../../core/engine/types";
import { isPlainObject, isRepeatMode } from "../../core/engine/validators";
import {
  clampVolume as sharedClampVolume,
  clampRate as sharedClampRate,
} from "../audio/clamp";
import { createLogger } from "../../helpers/logger";
import {
  deserializeVersionedJson,
  serializeVersioned,
} from "../validators";

const logger = createLogger("engineSettingsPersistence");

const ENGINE_SETTINGS_KEY = "htmlplayer-engine-settings";

function clampVolume(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return sharedClampVolume(value);
}

function clampRate(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return sharedClampRate(value);
}

function clampSemitones(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(12, Math.max(-12, value));
}

function clampNonNegative(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function sanitizeEngineSettings(
  raw: unknown,
): Partial<EngineSettings> {
  if (!isPlainObject(raw)) return {};

  const candidate = raw as Record<string, unknown>;
  const volume = clampVolume(candidate.volume);
  const crossfade = clampNonNegative(candidate.crossfade);
  const crossfadeBeforeGapless = clampNonNegative(
    candidate.crossfadeBeforeGapless,
  );
  const tempo = clampRate(candidate.tempo);
  const pitch = clampSemitones(candidate.pitch);
  const autoPlayNext = toOptionalBoolean(candidate.autoPlayNext);
  const gaplessPlayback = toOptionalBoolean(candidate.gaplessPlayback);
  const smartShuffle = toOptionalBoolean(candidate.smartShuffle);
  const defaultShuffle = toOptionalBoolean(candidate.defaultShuffle);

  const result: Partial<EngineSettings> = {};
  if (volume !== undefined) result.volume = volume;
  if (crossfade !== undefined) result.crossfade = crossfade;
  if (crossfadeBeforeGapless !== undefined) {
    result.crossfadeBeforeGapless = crossfadeBeforeGapless;
  }
  if (autoPlayNext !== undefined) result.autoPlayNext = autoPlayNext;
  if (tempo !== undefined) result.tempo = tempo;
  if (pitch !== undefined) result.pitch = pitch;
  if (gaplessPlayback !== undefined) result.gaplessPlayback = gaplessPlayback;
  if (smartShuffle !== undefined) result.smartShuffle = smartShuffle;
  if (isRepeatMode(candidate.repeat)) result.repeat = candidate.repeat;
  if (defaultShuffle !== undefined) result.defaultShuffle = defaultShuffle;
  if (isRepeatMode(candidate.defaultRepeat)) {
    result.defaultRepeat = candidate.defaultRepeat;
  }

  return result;
}

export class EngineSettingsPersistence {
  save(settings: EngineSettings): void {
    try {
      localStorage.setItem(ENGINE_SETTINGS_KEY, serializeVersioned(settings));
    } catch (error) {
      logger.error("Failed to save engine settings:", {
        error: String(error),
      });
    }
  }

  load(): Partial<EngineSettings> | null {
    try {
      const envelope = deserializeVersionedJson(
        localStorage.getItem(ENGINE_SETTINGS_KEY),
      );
      if (!envelope) return null;
      const cleaned = sanitizeEngineSettings(envelope.value);
      return Object.keys(cleaned).length > 0 ? cleaned : null;
    } catch (error) {
      logger.error("Failed to load engine settings:", {
        error: String(error),
      });
      return null;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(ENGINE_SETTINGS_KEY);
    } catch (error) {
      logger.error("Failed to clear engine settings:", {
        error: String(error),
      });
    }
  }
}

export const engineSettingsPersistence = new EngineSettingsPersistence();