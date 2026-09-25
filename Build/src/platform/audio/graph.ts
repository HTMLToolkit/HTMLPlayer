import { Equalizer } from "./equalizer";
import { clampVolume } from "./clamp";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("audioGraph");

const ANALYSER_FFT_SIZE = 2048;
const MAX_PITCH_SEMITONES = 48;
const MAX_REPLAY_GAIN_DB = 60;

export class AudioGraph {
  private context: AudioContext | null = null;
  private chainInput: GainNode | null = null;
  private replayGainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private volume = 1;
  private replayGainDb: number | null = null;

  private pitchShift: import("tone").PitchShift | null = null;
  private toneModule: typeof import("tone") | null = null;
  private pitchSemitones = 0;

  private equalizer = new Equalizer();

  private mediaElementSources = new WeakMap<
    HTMLMediaElement,
    MediaElementAudioSourceNode
  >();
  private disposed = false;

  getContext(): AudioContext {
    return this.ensureContext();
  }

  getAnalyser(): AnalyserNode | null {
    try {
      this.ensureContext();
      return this.analyser;
    } catch {
      return null;
    }
  }

  connectMediaElement(audio: HTMLMediaElement): MediaElementAudioSourceNode {
    const cached = this.mediaElementSources.get(audio);
    if (cached) return cached;

    const context = this.ensureContext();
    const source = context.createMediaElementSource(audio);
    source.connect(this.ensureChainInput());
    this.mediaElementSources.set(audio, source);
    return source;
  }

  createBufferSourceNode(buffer: AudioBuffer): AudioBufferSourceNode {
    const context = this.ensureContext();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ensureChainInput());
    return source;
  }

  setVolume(volume: number): void {
    this.volume = clampVolume(volume);
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  setReplayGain(gainDb: number | null): void {
    this.replayGainDb = gainDb;

    const linear =
      gainDb === null || !Number.isFinite(gainDb)
        ? 1
        : Math.pow(10, Math.max(-MAX_REPLAY_GAIN_DB, Math.min(MAX_REPLAY_GAIN_DB, gainDb)) / 20);

    if (this.replayGainNode) {
      this.replayGainNode.gain.value = linear;
    }
  }

  getReplayGain(): number | null {
    return this.replayGainDb;
  }

  resume(): void {
    if (this.context && this.context.state === "suspended") {
      this.context.resume().catch((error: unknown) => {
        logger.warn("AudioContext resume failed:", { error: String(error) });
      });
    }
  }

  async setPitch(semitones: number): Promise<void> {
    const clamped = Math.max(
      -MAX_PITCH_SEMITONES,
      Math.min(MAX_PITCH_SEMITONES, semitones),
    );
    this.pitchSemitones = clamped;

    if (clamped === 0) {
      this.removePitchShift();
      return;
    }

    if (this.pitchShift) {
      this.pitchShift.pitch = clamped;
      this.rebuildFxChain();
      return;
    }

    try {
      const tone = await this.loadTone();
      this.pitchShift = new tone.PitchShift({
        pitch: clamped,
        windowSize: 0.1,
      });
      this.rebuildFxChain();
    } catch (error) {
      logger.error("Pitch shift unavailable:", { error: String(error) });
    }
  }

  getPitchSemitones(): number {
    return this.pitchSemitones;
  }

  getPitchShiftNode(): import("tone").PitchShift | null {
    return this.pitchShift;
  }

  setEqualizer(enabled: boolean): void {
    this.equalizer.setEnabled(enabled);

    if (enabled) {
      try {
        const context = this.ensureContext();
        this.equalizer.build(context);
      } catch (error) {
        logger.warn("Equalizer unavailable:", { error: String(error) });
      }
    }

    this.rebuildFxChain();
  }

  getEqualizer(): Equalizer {
    return this.equalizer;
  }

  dispose(): void {
    this.disposed = true;

    this.mediaElementSources = new WeakMap();

    this.removePitchShift();

    this.equalizer.disconnect();
    this.chainInput?.disconnect();
    this.replayGainNode?.disconnect();
    this.analyser?.disconnect();
    this.masterGain?.disconnect();

    if (this.context) {
      this.context.close().catch((error: unknown) => {
        logger.warn("AudioContext close failed:", { error: String(error) });
      });
      this.context = null;
    }

    this.chainInput = null;
    this.replayGainNode = null;
    this.analyser = null;
    this.masterGain = null;
    this.toneModule = null;
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    if (this.disposed) {
      throw new Error("AudioGraph has been disposed");
    }

    const context = new AudioContext();
    const chainInput = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = ANALYSER_FFT_SIZE;
    analyser.smoothingTimeConstant = 0.8;
    const masterGain = context.createGain();
    masterGain.gain.value = this.volume;

    const replayGainNode = context.createGain();
    replayGainNode.gain.value =
      this.replayGainDb === null
        ? 1
        : Math.pow(
            10,
            Math.max(
              -MAX_REPLAY_GAIN_DB,
              Math.min(MAX_REPLAY_GAIN_DB, this.replayGainDb),
            ) / 20,
          );

    chainInput.connect(replayGainNode);
    replayGainNode.connect(analyser);
    analyser.connect(masterGain);
    masterGain.connect(context.destination);

    this.context = context;
    this.chainInput = chainInput;
    this.replayGainNode = replayGainNode;
    this.analyser = analyser;
    this.masterGain = masterGain;

    return context;
  }

  private ensureChainInput(): GainNode {
    this.ensureContext();
    return this.chainInput!;
  }

  private getPitchInputNode(): AudioNode | null {
    if (!this.pitchShift) return null;
    const input = (this.pitchShift.input as import("tone").Gain).input;
    return input;
  }

  private getPitchOutputNode(): AudioNode | null {
    if (!this.pitchShift) return null;
    const crossFade = this.pitchShift.output as import("tone").CrossFade;
    return (crossFade.output as import("tone").Gain).output;
  }

  private rebuildFxChain(): void {
    if (!this.chainInput || !this.analyser) return;

    this.chainInput.disconnect();
    this.replayGainNode?.disconnect();
    this.equalizer.disconnect();
    this.getPitchOutputNode()?.disconnect();

    let tail: AudioNode = this.replayGainNode ?? this.chainInput;

    if (this.pitchShift && this.pitchSemitones !== 0) {
      const pitchInput = this.getPitchInputNode();
      const pitchOutput = this.getPitchOutputNode();
      if (pitchInput && pitchOutput) {
        tail.connect(pitchInput);
        tail = pitchOutput;
      }
    }

    const eqNodes = this.equalizer.nodes;
    if (this.equalizer.isEnabled() && eqNodes.length > 0) {
      tail.connect(eqNodes[0]!);
      tail = eqNodes[eqNodes.length - 1]!;
    }

    tail.connect(this.analyser);
  }

  private removePitchShift(): void {
    if (this.pitchShift) {
      this.pitchShift.dispose();
      this.pitchShift = null;
    }

    this.rebuildFxChain();
  }

  private async loadTone(): Promise<typeof import("tone")> {
    if (this.toneModule) return this.toneModule;

    const context = this.ensureContext();
    const tone = await import("tone");
    tone.setContext(new tone.Context({ context }));
    this.toneModule = tone;
    return tone;
  }
}