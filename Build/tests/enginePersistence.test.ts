import { describe, it, beforeEach, expect, jest } from "@jest/globals";
import {
  engineSettingsPersistence,
  sanitizeEngineSettings,
} from "../src/platform/settings/enginePersistence";
import type { EngineSettings } from "../src/core/engine/types";

const DEFAULT: EngineSettings = {
  volume: 1,
  crossfade: 0,
  crossfadeBeforeGapless: 3000,
  autoPlayNext: true,
  tempo: 1,
  pitch: 0,
  gaplessPlayback: true,
  smartShuffle: true,
  repeat: "off",
  defaultShuffle: false,
  defaultRepeat: "off",
};

function fullSettings(overrides: Partial<EngineSettings>): EngineSettings {
  return { ...DEFAULT, ...overrides };
}

describe("engineSettingsPersistence", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("round-trips a full engine settings snapshot", () => {
    const settings = fullSettings({
      volume: 0.5,
      tempo: 1.25,
      pitch: 3,
      crossfade: 4,
      gaplessPlayback: false,
      smartShuffle: false,
      repeat: "one",
      autoPlayNext: false,
    });
    engineSettingsPersistence.save(settings);

    const loaded = engineSettingsPersistence.load();
    expect(loaded).toEqual(settings);
  });

  it("returns null when nothing was persisted", () => {
    expect(engineSettingsPersistence.load()).toBeNull();
  });

  it("returns null for an unversioned legacy blob", () => {
    localStorage.setItem(
      "htmlplayer-engine-settings",
      JSON.stringify({ volume: 0.4 }),
    );
    expect(engineSettingsPersistence.load()).toBeNull();
  });

  it("ignores the corrupted blob and returns null", () => {
    localStorage.setItem("htmlplayer-engine-settings", "{not json");
    expect(engineSettingsPersistence.load()).toBeNull();
  });

  it("clears the stored settings", () => {
    engineSettingsPersistence.save(fullSettings({}));
    engineSettingsPersistence.clear();
    expect(localStorage.getItem("htmlplayer-engine-settings")).toBeNull();
  });

  it("does not throw when localStorage is unavailable", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    expect(engineSettingsPersistence.load()).toBeNull();
    expect(() =>
      engineSettingsPersistence.save(fullSettings({})),
    ).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("sanitizeEngineSettings clamps out-of-range values", () => {
    const cleaned = sanitizeEngineSettings({
      volume: 5,
      tempo: 99,
      pitch: -99,
      crossfade: -3,
    } as unknown as Record<string, unknown>);

    expect(cleaned).toEqual({
      volume: 1,
      tempo: 4,
      pitch: -12,
      crossfade: 0,
    });
  });

  it("sanitizeEngineSettings drops wrong-typed and unknown fields", () => {
    const cleaned = sanitizeEngineSettings({
      volume: "loud",
      gaplessPlayback: 1,
      smartShuffle: "yes",
      repeat: "round",
      unknownField: 42,
    } as unknown as Record<string, unknown>);

    expect(cleaned).toEqual({});
  });

  it("sanitizeEngineSettings rejects non-object payloads", () => {
    expect(sanitizeEngineSettings(null)).toEqual({});
    expect(sanitizeEngineSettings("volume: 1")).toEqual({});
    expect(sanitizeEngineSettings([1, 2])).toEqual({});
  });
});