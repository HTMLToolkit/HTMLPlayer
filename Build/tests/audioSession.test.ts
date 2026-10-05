import { describe, it, expect, afterEach } from "@jest/globals";
import {
  declarePlaybackSession,
  currentAudioSessionType,
  PLAYBACK_SESSION_TYPE,
} from "../src/platform/audio/session/audioSession";

interface MutableAudioSession {
  type: string;
}

const originalNavigator = globalThis.navigator;

const withAudioSession = (
  session: Partial<MutableAudioSession> | undefined,
): void => {
  Object.defineProperty(globalThis, "navigator", {
    value: session === undefined ? {} : { audioSession: session },
    configurable: true,
  });
};

const withRejectedAudioSession = (): void => {
  const session = {
    get type(): string {
      return "ambient";
    },
    set type(_value: string) {
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { audioSession: session },
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
  });
});

describe("declarePlaybackSession", () => {
  it("reports no support when the Audio Session API is absent", () => {
    withAudioSession(undefined);

    expect(declarePlaybackSession()).toEqual({
      supported: false,
      type: null,
      previousType: null,
      applied: false,
    });
  });

  it("upgrades an ambient session to playback", () => {
    withAudioSession({ type: "ambient" });

    expect(declarePlaybackSession()).toEqual({
      supported: true,
      type: PLAYBACK_SESSION_TYPE,
      previousType: "ambient",
      applied: true,
    });
  });

  it("leaves an already-playback session untouched", () => {
    const session: MutableAudioSession = { type: PLAYBACK_SESSION_TYPE };
    withAudioSession(session);

    expect(declarePlaybackSession()).toEqual({
      supported: true,
      type: PLAYBACK_SESSION_TYPE,
      previousType: PLAYBACK_SESSION_TYPE,
      applied: false,
    });
  });

  it("reports applied=false when the engine refuses the assignment", () => {
    withRejectedAudioSession();

    const declaration = declarePlaybackSession();

    expect(declaration.supported).toBe(true);
    expect(declaration.applied).toBe(false);
    expect(declaration.type).toBe("ambient");
  });
});

describe("currentAudioSessionType", () => {
  it("returns null when the API is absent", () => {
    withAudioSession(undefined);

    expect(currentAudioSessionType()).toBeNull();
  });

  it("returns the live session type", () => {
    const session: MutableAudioSession = { type: "ambient" };
    withAudioSession(session);

    expect(currentAudioSessionType()).toBe("ambient");
    session.type = "playback";
    expect(currentAudioSessionType()).toBe("playback");
  });
});
