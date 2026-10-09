import { describeError } from "../../../helpers/logger";
import floWorkletSource from "./floWorkletSource";

const PROBE_SAMPLE_RATE = 44100;
const PROBE_FRAME_COUNT = 1;

export type WorkletProbeFailure =
  "no-offline-audio-context" | "no-audio-worklet" | "load-failed";

export type WorkletProbeResult =
  | { supported: true }
  | { supported: false; reason: WorkletProbeFailure; detail: string };

export async function probeStreamingWorklet(): Promise<WorkletProbeResult> {
  if (typeof OfflineAudioContext !== "function") {
    return {
      supported: false,
      reason: "no-offline-audio-context",
      detail:
        "OfflineAudioContext is unavailable, so the streaming output worklet cannot be probed.",
    };
  }

  const ctx = new OfflineAudioContext(1, PROBE_FRAME_COUNT, PROBE_SAMPLE_RATE);
  if (!ctx.audioWorklet) {
    return {
      supported: false,
      reason: "no-audio-worklet",
      detail:
        "AudioWorklet is unavailable, so streaming decode has no output stage.",
    };
  }

  const source = URL.createObjectURL(
    new Blob([floWorkletSource], { type: "text/javascript" }),
  );
  try {
    await ctx.audioWorklet.addModule(source);
    return { supported: true };
  } catch (error) {
    return {
      supported: false,
      reason: "load-failed",
      detail: describeError(error),
    };
  } finally {
    URL.revokeObjectURL(source);
  }
}
