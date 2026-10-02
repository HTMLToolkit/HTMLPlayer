import { AudioGraph } from "../src/platform/audio/graph";
import { HTMLAudioBackend } from "../src/platform/audio/backends/HTMLBackend";
import { StreamingDecoderBackend } from "../src/platform/audio/backends/StreamingDecoderBackend";
import { BackendRouter } from "../src/platform/audio/backends/BackendRouter";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

interface FakeAudioNode {
  connect: jest.Mock;
  disconnect: jest.Mock;
  gain: { value: number };
}

function createFakeNode(): FakeAudioNode {
  return {
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
    gain: { value: 1 },
  };
}

interface FakePitchShift {
  pitch: number;
  input: { input: FakeAudioNode };
  output: { output: FakeAudioNode };
  dispose: jest.Mock;
}

interface GraphInternals {
  chainInput: FakeAudioNode;
  replayGainNode: FakeAudioNode | null;
  eqPreampNode: FakeAudioNode | null;
  analyser: FakeAudioNode;
  pitchShift: FakePitchShift | null;
  pitchSemitones: number;
}

const graphBypass = (graph: AudioGraph): GraphInternals =>
  graph as unknown as GraphInternals;

function installChain(
  graph: AudioGraph,
  semitones: number,
): { pitchShift: FakePitchShift; eqPreampNode: FakeAudioNode } {
  const chainInput = createFakeNode();
  const eqPreampNode = createFakeNode();
  const analyser = createFakeNode();
  const pitchInput = createFakeNode();
  const pitchOutput = createFakeNode();

  const pitchShift: FakePitchShift = {
    pitch: semitones,
    input: { input: pitchInput },
    output: { output: { output: pitchOutput } },
    dispose: jest.fn(),
  };

  const internals = graphBypass(graph);
  internals.chainInput = chainInput;
  internals.replayGainNode = null;
  internals.eqPreampNode = eqPreampNode;
  internals.analyser = analyser;
  internals.pitchShift = pitchShift;
  internals.pitchSemitones = semitones;

  return { pitchShift, eqPreampNode };
}

const rebuildFxChain = (graph: AudioGraph): void => {
  (graph as unknown as { rebuildFxChain(): void }).rebuildFxChain();
};

describe("pitch Fx chain", () => {
  let graph: AudioGraph;

  beforeEach(() => {
    graph = new AudioGraph();
  });

  afterEach(() => {
    graph.dispose();
  });

  it("inserts the pitch shift in the signal path when semitones are non-zero", async () => {
    const { pitchShift, eqPreampNode } = installChain(graph, 6);
    const internals = graphBypass(graph);

    await graph.setPitch(6);

    expect(pitchShift.pitch).toBe(6);
    expect(graph.getPitchShiftNode()).not.toBeNull();
    expect(internals.chainInput.connect).toHaveBeenCalledWith(
      pitchShift.input.input,
    );
    expect(pitchShift.output.output.output.connect).toHaveBeenCalledWith(
      eqPreampNode,
    );
    expect(eqPreampNode.connect).toHaveBeenCalledWith(internals.analyser);
    expect(internals.chainInput.connect).not.toHaveBeenCalledWith(
      internals.analyser,
    );
  });

  it("bypasses the pitch shift when semitones drop to zero", async () => {
    const { pitchShift, eqPreampNode } = installChain(graph, 4);
    const internals = graphBypass(graph);

    await graph.setPitch(0);

    expect(graph.getPitchShiftNode()).toBeNull();
    expect(pitchShift.dispose).toHaveBeenCalled();
    expect(internals.chainInput.connect).toHaveBeenCalledWith(eqPreampNode);
    expect(eqPreampNode.connect).toHaveBeenCalledWith(internals.analyser);
    expect(internals.chainInput.connect).not.toHaveBeenCalledWith(
      internals.analyser,
    );
  });

  it("rebuilds with an empty stop even when no chain state exists yet", () => {
    expect(() => rebuildFxChain(graph)).not.toThrow();
  });
});

describe("analyser parity across backends", () => {
  it("reports the same analyser from the shared graph on every backend", () => {
    const graph = new AudioGraph();
    const analyserNode = createFakeNode() as unknown as AnalyserNode & {
      fftSize: number;
      smoothingTimeConstant: number;
    };

    const mockAudioContext = (
      globalThis as { AudioContext: { prototype: { createAnalyser?: () => unknown } } }
    ).AudioContext;
    const originalCreateAnalyser = mockAudioContext.prototype.createAnalyser;
    mockAudioContext.prototype.createAnalyser = () => analyserNode;

    const html: HTMLAudioBackend[] = [];
    try {
      expect(graph.getAnalyser()).toBe(analyserNode);

      html.push(new HTMLAudioBackend(graph));
      const flo = new StreamingDecoderBackend(graph, "flo");
      const router = new BackendRouter(graph);

      expect(html[0]!.getAnalyser()).toBe(analyserNode);
      expect(flo.getAnalyser()).toBe(analyserNode);
      expect(router.getAnalyser()).toBe(analyserNode);

      flo.dispose();
      flo.dispose();
      router.dispose();
    } finally {
      mockAudioContext.prototype.createAnalyser = originalCreateAnalyser;
      for (const backend of html) {
        backend.dispose();
      }
      graph.dispose();
    }
  });

  it("reports no analyser on any backend once the shared graph is disposed", () => {
    const graph = new AudioGraph();

    const html = new HTMLAudioBackend(graph);
    const router = new BackendRouter(graph);

    try {
      graph.dispose();
      expect(html.getAnalyser()).toBeNull();
      expect(router.getAnalyser()).toBeNull();
    } finally {
      html.dispose();
      router.dispose();
    }
  });
});