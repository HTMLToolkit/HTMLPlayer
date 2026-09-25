import { AudioGraph } from "../src/platform/audio/graph";
import { HTMLAudioBackend } from "../src/platform/audio/backends/HTMLBackend";
import { BufferSourceBackend } from "../src/platform/audio/backends/BufferSourceBackend";
import { FloBackend } from "../src/platform/audio/backends/FloBackend";
import { BackendRouter } from "../src/platform/audio/backends/BackendRouter";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

interface FakeAudioNode {
  connect: jest.Mock;
  disconnect: jest.Mock;
}

function createFakeNode(): FakeAudioNode {
  return {
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
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
  analyser: FakeAudioNode;
  pitchShift: FakePitchShift | null;
  pitchSemitones: number;
}

const graphBypass = (graph: AudioGraph): GraphInternals =>
  graph as unknown as GraphInternals;

function installChain(graph: AudioGraph, semitones: number): FakePitchShift {
  const chainInput = createFakeNode();
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
  internals.analyser = analyser;
  internals.pitchShift = pitchShift;
  internals.pitchSemitones = semitones;

  return pitchShift;
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
    const pitchShift = installChain(graph, 6);
    const internals = graphBypass(graph);

    await graph.setPitch(6);

    expect(pitchShift.pitch).toBe(6);
    expect(graph.getPitchShiftNode()).not.toBeNull();
    expect(internals.chainInput.connect).toHaveBeenCalledWith(
      pitchShift.input.input,
    );
    expect(pitchShift.output.output.output.connect).toHaveBeenCalledWith(
      internals.analyser,
    );
    expect(internals.chainInput.connect).not.toHaveBeenCalledWith(
      internals.analyser,
    );
  });

  it("bypasses the pitch shift when semitones drop to zero", async () => {
    const pitchShift = installChain(graph, 4);
    const internals = graphBypass(graph);

    await graph.setPitch(0);

    expect(graph.getPitchShiftNode()).toBeNull();
    expect(pitchShift.dispose).toHaveBeenCalled();
    expect(internals.chainInput.connect).toHaveBeenCalledWith(internals.analyser);
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
      const buffered = new BufferSourceBackend(graph);
      const flo = new FloBackend(graph);
      const router = new BackendRouter(graph);

      expect(html[0]!.getAnalyser()).toBe(analyserNode);
      expect(buffered.getAnalyser()).toBe(analyserNode);
      expect(flo.getAnalyser()).toBe(analyserNode);
      expect(router.getAnalyser()).toBe(analyserNode);

      buffered.dispose();
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

  it("falls back to null for every backend before a live context exists", () => {
    const graph = new AudioGraph();

    const html = new HTMLAudioBackend(graph);
    const buffered = new BufferSourceBackend(graph);
    const router = new BackendRouter(graph);

    try {
      expect(html.getAnalyser()).toBeNull();
      expect(buffered.getAnalyser()).toBeNull();
      expect(router.getAnalyser()).toBeNull();
    } finally {
      html.dispose();
      buffered.dispose();
      router.dispose();
    }
  });
});