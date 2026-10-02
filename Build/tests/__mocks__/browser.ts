/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReadableStream } from "node:stream/web";
import { webcrypto } from "node:crypto";

declare const global: any;

if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
}

if (!global.crypto) {
  global.crypto = webcrypto;
} else if (!global.crypto.subtle) {
  Object.defineProperty(global.crypto, "subtle", {
    value: webcrypto.subtle,
    configurable: true,
  });
}

function createMockParam(value: number): any {
  return {
    value,
    setValueAtTime(): void {},
    setTargetAtTime(): void {},
    linearRampToValueAtTime(): void {},
    exponentialRampToValueAtTime(): void {},
    cancelScheduledValues(): void {},
  };
}

function createMockGainNode(): any {
  return {
    gain: createMockParam(1),
    connect(): any {
      return this;
    },
    disconnect(): void {},
  };
}

function createMockBiquadFilterNode(type = "peaking"): any {
  return {
    type,
    frequency: createMockParam(350),
    gain: createMockParam(0),
    Q: createMockParam(1),
    detune: createMockParam(0),
    connect(): any {
      return this;
    },
    disconnect(): void {},
  };
}

function MockAudioContext(this: any): void {
  this.sampleRate = 44100;
  this.baseLatency = 0;
  this.destination = {};
}

MockAudioContext.prototype.close = function(): Promise<void> {
  return Promise.resolve();
};

MockAudioContext.prototype.createGain = function(): any {
  return createMockGainNode();
};

MockAudioContext.prototype.createBiquadFilter = function(type?: string): any {
  return createMockBiquadFilterNode(type);
};

MockAudioContext.prototype.createAnalyser = function(): any {
  return {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 0,
    getByteFrequencyData(): void {},
    getFloatFrequencyData(): void {},
    getByteTimeDomainData(): void {},
    connect(): any {
      return this;
    },
    disconnect(): void {},
  };
};

MockAudioContext.prototype.createBuffer = function(
  channels: number,
  length: number,
  sampleRate: number
): any {
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: () => new Float32Array(length),
  };
};

MockAudioContext.prototype.createBufferSource = function(): any {
  return {
    buffer: null,
    connect: () => {},
    disconnect: () => {},
    start: () => {},
    stop: () => {},
  };
};

MockAudioContext.prototype.decodeAudioData = function(
  buffer: ArrayBuffer,
  successCallback?: (decoded: any) => void,
  errorCallback?: (error: any) => void
): Promise<any> {
  const decoded = this.createBuffer(2, 44100, 44100);
  successCallback?.(decoded);
  return Promise.resolve(decoded).catch((err) => {
    errorCallback?.(err);
    throw err;
  });
};

const listeners = new Map<string, Set<any>>();

function MockAudio(this: any): void {
  this.src = "";
  this.currentTime = 0;
  this.duration = 0;
  this.paused = true;
  this.volume = 1;
  this.playbackRate = 1;
  this.readyState = 4;
  this.HAVE_ENOUGH_DATA = 4;
}

MockAudio.prototype.play = function(): Promise<void> {
  return Promise.resolve();
};
MockAudio.prototype.pause = function(): void {};
MockAudio.prototype.load = function(): void {};

MockAudio.prototype.addEventListener = function(event: string, callback: any): void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(callback);
};

MockAudio.prototype.removeEventListener = function(event: string, callback: any): void {
  listeners.get(event)?.delete(callback);
};

MockAudio.prototype.dispatchEvent = function(event: any): boolean {
  listeners.get(event.type)?.forEach((listener) => listener());
  return true;
};

(global as any).AudioContext = MockAudioContext;
(global as any).webkitAudioContext = MockAudioContext;
(global as any).Audio = MockAudio;
