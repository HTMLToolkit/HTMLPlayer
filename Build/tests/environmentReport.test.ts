import { describe, it, expect, afterEach, jest } from "@jest/globals";
import {
  collectEnvironmentReport,
  detectBrowser,
} from "../src/platform/diagnostics/environmentReport";
import { importableFormats } from "../src/platform/audio/formats";
import { probeStreamingWorklet } from "../src/platform/audio/stream/streamingWorkletProbe";
import { opfsAvailability } from "../src/platform/storage/opfs";

jest.mock("../src/platform/audio/stream/streamingWorkletProbe");
jest.mock("../src/platform/storage/opfs");

const probeMock = jest.mocked(probeStreamingWorklet);
const opfsMock = jest.mocked(opfsAvailability);

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15";

const originalNavigator = globalThis.navigator;

const withUserAgent = (userAgent: string): void => {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent, platform: "test" },
    configurable: true,
  });
};

const stubOpfsAvailable = (): void => {
  opfsMock.mockReturnValue({ available: true });
};

const stubWorkletSupported = (): void => {
  probeMock.mockResolvedValue({ supported: true });
};

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
  });
  jest.clearAllMocks();
});

describe("detectBrowser", () => {
  it("identifies Chromium from a Chrome user agent", () => {
    withUserAgent(CHROME_UA);

    expect(detectBrowser()).toEqual({
      family: "Chromium",
      version: "126.0.0.0",
      isSafari: false,
    });
  });

  it("prefers the Edge token over the Chrome token it also carries", () => {
    withUserAgent(EDGE_UA);

    expect(detectBrowser().family).toBe("Edge");
  });

  it("identifies Safari through the shared Safari predicate", () => {
    withUserAgent(SAFARI_UA);

    expect(detectBrowser()).toEqual({
      family: "Safari",
      version: "18.4",
      isSafari: true,
    });
  });

  it("reports Unknown instead of guessing", () => {
    withUserAgent("some-unidentified-agent");

    expect(detectBrowser().family).toBe("Unknown");
  });
});

describe("collectEnvironmentReport", () => {
  it("keeps the streaming worklet failure visible with its detail", async () => {
    withUserAgent(CHROME_UA);
    stubOpfsAvailable();
    probeMock.mockResolvedValue({
      supported: false,
      reason: "load-failed",
      detail: "Failed to load worklet module script: blob:null/abc",
    });

    const report = await collectEnvironmentReport();

    expect(report.streamingWorklet).toEqual({
      supported: false,
      reason: "load-failed",
      detail: "Failed to load worklet module script: blob:null/abc",
    });
  });

  it("surfaces the OPFS failure reason next to IndexedDB availability", async () => {
    withUserAgent(CHROME_UA);
    stubWorkletSupported();
    opfsMock.mockReturnValue({
      available: false,
      reason: "insecure-context",
      message: "OPFS requires a secure context.",
    });

    const report = await collectEnvironmentReport();

    expect(report.storage.opfs).toEqual({
      available: false,
      reason: "insecure-context",
    });
  });

  it("assigns a backend or unplayable verdict to every offered format", async () => {
    withUserAgent(CHROME_UA);
    stubOpfsAvailable();
    stubWorkletSupported();

    const report = await collectEnvironmentReport();
    const offered = importableFormats();

    for (const format of offered) {
      expect(Object.keys(report.backends)).toContain(format.id);
    }
    expect(report.formatCounts.total).toBe(offered.length);
    expect(report.formatCounts.playable + report.formatCounts.unplayable).toBe(
      report.formatCounts.total,
    );
  });

  it("reports a null audio session type on engines without the Audio Session API", async () => {
    withUserAgent(CHROME_UA);
    stubOpfsAvailable();
    stubWorkletSupported();

    const report = await collectEnvironmentReport();

    expect(report.audioSessionType).toBeNull();
  });

  it("surfaces an ambient audio session type, which is what iOS silences on background", async () => {
    withUserAgent(SAFARI_UA);
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: SAFARI_UA,
        platform: "test",
        audioSession: { type: "ambient" },
      },
      configurable: true,
    });
    stubOpfsAvailable();
    stubWorkletSupported();

    const report = await collectEnvironmentReport();

    expect(report.audioSessionType).toBe("ambient");
  });

  it("routes Flo to its own decoder regardless of HTML audio support", async () => {
    withUserAgent(CHROME_UA);
    stubOpfsAvailable();
    stubWorkletSupported();

    const report = await collectEnvironmentReport();

    expect(report.backends.flo).toBe("flo");
  });
});
