interface AudioSessionLike {
  type: string;
}

type NavigatorWithAudioSession = Navigator & {
  audioSession?: AudioSessionLike;
};

export const PLAYBACK_SESSION_TYPE = "playback";

export interface AudioSessionDeclaration {
  supported: boolean;
  type: string | null;
  previousType: string | null;
  applied: boolean;
}

function readAudioSession(): AudioSessionLike | null {
  if (typeof navigator === "undefined") return null;
  const { audioSession } = navigator as NavigatorWithAudioSession;
  return audioSession ?? null;
}

export function currentAudioSessionType(): string | null {
  return readAudioSession()?.type ?? null;
}

export function declarePlaybackSession(): AudioSessionDeclaration {
  const session = readAudioSession();
  if (!session) {
    return { supported: false, type: null, previousType: null, applied: false };
  }

  const previousType = session.type;
  if (previousType === PLAYBACK_SESSION_TYPE) {
    return {
      supported: true,
      type: previousType,
      previousType,
      applied: false,
    };
  }

  session.type = PLAYBACK_SESSION_TYPE;
  return {
    supported: true,
    type: session.type,
    previousType,
    applied: session.type === PLAYBACK_SESSION_TYPE,
  };
}
