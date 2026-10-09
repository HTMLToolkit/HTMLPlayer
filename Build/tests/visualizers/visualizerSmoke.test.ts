import * as fs from "fs";
import * as path from "path";
import type {
  VisualizerType,
} from "../../src/platform/visualizers";
import { clearVisualizerState, visualizerStates } from "../../src/platform/visualizers";

interface RecordingContext {
  violations: string[];
  callCount: () => number;
  ctx: CanvasRenderingContext2D;
}

function createRecordingContext(canvas: HTMLCanvasElement): RecordingContext {
  const violations: string[] = [];
  const callCountTarget: { n: number } = { n: 0 };
  const backing = new Map<string | symbol, unknown>();

  const record = (method: string, args: unknown[]): void => {
    callCountTarget.n += 1;
    for (const arg of args) {
      if (typeof arg === "number" && !Number.isFinite(arg)) {
        violations.push(
          `${method}(${args.map((a) => String(a)).join(", ")})`,
        );
      }
    }
  };

  const gradient = () => ({ addColorStop: (...args: unknown[]): void => void record("gradient.addColorStop", args) });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (backing.has(prop)) return backing.get(prop);
      if (prop === "canvas") return canvas;
      if (prop === "measureText") {
        return (text: string) => ({ width: text.length * 7.2 });
      }
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return (...args: unknown[]): ReturnType<typeof gradient> => {
          record(String(prop), args);
          return gradient();
        };
      }
      if (prop === "createPattern") {
        return (...args: unknown[]): object => {
          record(String(prop), args);
          return {};
        };
      }
      if (prop === "getImageData") {
        return (x: number, y: number, w: number, h: number) => {
          record("getImageData", [x, y, w, h]);
          return {
            data: new Uint8ClampedArray(Number(w) * Number(h) * 4),
            width: w,
            height: h,
          };
        };
      }
      if (typeof prop === "symbol") return target[prop];
      return (...args: unknown[]): void => record(String(prop), args);
    },
    set(target, prop, value) {
      if (typeof value === "number" && !Number.isFinite(value)) {
        violations.push(`set ${String(prop)} = ${value}`);
      }
      backing.set(prop, value);
      target[prop] = value;
      return true;
    },
  };

  const proxied = new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
  return {
    violations,
    callCount: () => callCountTarget.n,
    ctx: proxied,
  };
}

const BUFFER_LENGTH = 256;

function createAnalyserMock(frame: number): AnalyserNode {
  const fillByte = (arr: Uint8Array | Float32Array): void => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor((Math.sin(i * 0.35 + frame * 0.7) * 0.5 + 0.5) * 255);
    }
  };
  const fillFloat = (arr: Uint8Array | Float32Array, min: number, max: number): void => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = (Math.sin(i * 0.25 + frame) * 0.5 + 0.5) * (max - min) + min;
    }
  };
  const mock = {
    fftSize: BUFFER_LENGTH * 2,
    frequencyBinCount: BUFFER_LENGTH,
    smoothingTimeConstant: 0.8,
    minDecibels: -100,
    maxDecibels: -30,
    getByteFrequencyData: fillByte,
    getByteTimeDomainData: fillByte,
    getFloatFrequencyData: (arr: Float32Array): void => void fillFloat(arr, -120, 0),
    getFloatTimeDomainData: (arr: Float32Array): void => void fillFloat(arr, -1, 1),
  };
  return mock as unknown as AnalyserNode;
}

function createCanvasMock(): HTMLCanvasElement {
  const mock = {
    width: 800,
    height: 600,
    getContext: () => null,
  };
  return mock as unknown as HTMLCanvasElement;
}

const createElementOriginal = document.createElement.bind(document);

function wireCanvasGetContext(recording: RecordingContext): void {
  jest.spyOn(document, "createElement").mockImplementation((tag) => {
    const element = createElementOriginal(tag);
    if (String(tag).toLowerCase() === "canvas") {
      Object.defineProperty(element, "getContext", {
        configurable: true,
        value: (...args: unknown[]) => {
          if (args[0] === "2d") return recording.ctx;
          return null;
        },
      });
    }
    return element;
  });
}

function resolveDefaults(
  config?: VisualizerType["settingsConfig"],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!config) return result;
  for (const [key, spec] of Object.entries(config)) {
    if (spec && spec.default !== undefined) {
      result[key] = spec.default;
    }
  }
  return result;
}

describe("Visualizer runtime smoke: every .visualizer draw() draws finite frames", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const visualizerDir = path.join(
    process.cwd(),
    "src/ui/resources/visualizers",
  );
  const files = fs
    .readdirSync(visualizerDir)
    .filter((f) => f.endsWith(".visualizer.tsx"))
    .sort();

  it("discovers at least 20 visualizer modules", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  for (const file of files) {
    const key = file.replace(/\.visualizer\.tsx$/, "");
    it(`draw() renders finite frames without throwing (${file})`, async () => {
      clearVisualizerState();

      const mod = await import(`../../src/ui/resources/visualizers/${file}`);
      const viz = (mod as { default: VisualizerType }).default;
      expect(viz).toBeDefined();
      expect(typeof viz.draw).toBe("function");
      expect(typeof viz.name).toBe("string");
      expect(viz.name.length).toBeGreaterThan(0);

      const settingsVariants: Array<{ label: string; settings: Record<string, unknown> | undefined }> = [
        { label: "empty", settings: {} },
        { label: "undefined", settings: undefined },
        {
          label: "defaults",
          settings: resolveDefaults(viz.settingsConfig),
        },
      ];

      const recorded = createRecordingContext(createCanvasMock());
      const canvasMock = createCanvasMock();
      wireCanvasGetContext(recorded);

      for (let frame = 0; frame < 8; frame++) {
        const analyser = createAnalyserMock(frame);
        for (const variant of settingsVariants) {
          for (const BufferCtor of [Uint8Array, Float32Array] as const) {
            const dataArray = new BufferCtor(BUFFER_LENGTH);
            viz.draw(
              analyser,
              canvasMock,
              recorded.ctx,
              BUFFER_LENGTH,
              dataArray as Uint8Array | Float32Array,
              viz.dataType,
              variant.settings,
            );
          }
        }
      }

      if (recorded.callCount() === 0) {
        throw new Error(
          `${file} draw() performed no drawing calls - likely an early-return guard`,
        );
      }

      const message =
        recorded.violations.length === 0
          ? null
          : `non-finite drawing args across ${file}:\n${recorded.violations
              .slice(0, 20)
              .join("\n")}${recorded.violations.length > 20 ? "\n..." : ""}`;
      expect(message).toBeNull();

      expect(visualizerStates.size).toBeGreaterThanOrEqual(0);
    });
  }
});