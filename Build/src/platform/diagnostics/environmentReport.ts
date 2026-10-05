import { createLogger, describeError } from "../../helpers/logger";
import { isSafari } from "../utils/safari";
import { opfsAvailability } from "../storage/opfs";
import {
  canPlayWithHtmlAudio,
  chooseBackendFor,
  importableFormats,
  safariMajorVersion,
  type AudioFormat,
  type BackendKind,
} from "../audio/formats";
import { probeStreamingWorklet } from "../audio/stream/streamingWorkletProbe";
import { currentAudioSessionType } from "../audio/session/audioSession";

const logger = createLogger("environment");

export interface BrowserInfo {
  family: string;
  version: string | null;
  isSafari: boolean;
}

export interface StorageCapabilities {
  opfs: { available: boolean; reason: string | null };
  indexedDb: boolean;
  persisted: boolean | null;
}

export interface EnvironmentReport {
  singleFile: boolean;
  browser: BrowserInfo;
  platform: string;
  origin: string;
  protocol: string;
  isSecureContext: boolean;
  storage: StorageCapabilities;
  streamingWorklet: {
    supported: boolean;
    reason: string | null;
    detail: string | null;
  };
  audioSessionType: string | null;
  backends: Record<string, BackendKind | "unplayable">;
  formatCounts: {
    total: number;
    playable: number;
    unplayable: number;
  };
}

const CHROMIUM_LABELS: ReadonlyArray<readonly [string, RegExp]> = [
  ["Edge", /\bedg(?:e|a|ios)?\/([\d.]+)/],
  ["Opera", /\b(?:opr|opera)\/([\d.]+)/],
  ["Samsung Internet", /\bsamsungbrowser\/([\d.]+)/],
  ["Chromium", /\b(?:chrome|chromium|crios)\/([\d.]+)/],
];

const FIREFOX_LABEL: ReadonlyArray<readonly [string, RegExp]> = [
  ["Firefox", /\b(?:firefox|fxios)\/([\d.]+)/],
];

const firstMatch = (
  ua: string,
  labels: ReadonlyArray<readonly [string, RegExp]>,
): BrowserInfo | null => {
  for (const [family, pattern] of labels) {
    const match = pattern.exec(ua);
    if (match) return { family, version: match[1] ?? null, isSafari: false };
  }
  return null;
};

export function detectBrowser(): BrowserInfo {
  const ua =
    typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();

  if (isSafari()) {
    const major = safariMajorVersion();
    return {
      family: "Safari",
      version: major === null ? null : String(major),
      isSafari: true,
    };
  }

  return (
    firstMatch(ua, CHROMIUM_LABELS) ??
    firstMatch(ua, FIREFOX_LABEL) ?? {
      family: "Unknown",
      version: null,
      isSafari: false,
    }
  );
}

function readSingleFileFlag(): boolean {
  return typeof __IS_SINGLE_FILE__ !== "undefined" && __IS_SINGLE_FILE__;
}

function detectIndexedDb(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

async function detectPersisted(): Promise<boolean | null> {
  const storage =
    typeof navigator === "undefined" ? undefined : navigator.storage;
  if (typeof storage?.persisted !== "function") return null;
  try {
    return await storage.persisted();
  } catch (error) {
    logger.debug("StorageManager.persisted() failed", {
      error: describeError(error),
    });
    return null;
  }
}

function backendFor(format: AudioFormat): BackendKind | "unplayable" {
  const backend = chooseBackendFor(format, { hasStoredAudio: true });
  if (backend === "flo") return backend;
  return canPlayWithHtmlAudio(format) ? backend : "unplayable";
}

export async function collectEnvironmentReport(): Promise<EnvironmentReport> {
  const opfs = opfsAvailability();
  const worklet = await probeStreamingWorklet();
  const offered = importableFormats();
  const backends: Record<string, BackendKind | "unplayable"> = {};
  let unplayable = 0;

  for (const format of offered) {
    const backend = backendFor(format);
    backends[format.id] = backend;
    if (backend === "unplayable") unplayable += 1;
  }

  return {
    singleFile: readSingleFileFlag(),
    browser: detectBrowser(),
    platform: typeof navigator === "undefined" ? "" : navigator.platform,
    origin: typeof location === "undefined" ? "" : location.origin,
    protocol: typeof location === "undefined" ? "" : location.protocol,
    isSecureContext:
      typeof isSecureContext === "boolean" ? isSecureContext : false,
    storage: {
      opfs: {
        available: opfs.available,
        reason: opfs.available ? null : opfs.reason,
      },
      indexedDb: detectIndexedDb(),
      persisted: await detectPersisted(),
    },
    streamingWorklet: {
      supported: worklet.supported,
      reason: worklet.supported ? null : worklet.reason,
      detail: worklet.supported ? null : worklet.detail,
    },
    audioSessionType: currentAudioSessionType(),
    backends,
    formatCounts: {
      total: offered.length,
      playable: offered.length - unplayable,
      unplayable,
    },
  };
}

export async function logEnvironmentReport(): Promise<EnvironmentReport> {
  const report = await collectEnvironmentReport();

  logger.info("Environment capabilities", { report });

  if (!report.streamingWorklet.supported) {
    logger.warn(
      "Streaming decode is unavailable: the inlined audio worklet cannot load in this environment",
      {
        reason: report.streamingWorklet.reason,
        detail: report.streamingWorklet.detail,
      },
    );
  }
  if (!report.storage.opfs.available) {
    logger.warn("OPFS is unavailable; imported audio cannot be persisted", {
      reason: report.storage.opfs.reason,
    });
  }

  return report;
}
