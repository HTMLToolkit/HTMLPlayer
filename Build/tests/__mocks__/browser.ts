/* eslint-disable @typescript-eslint/no-explicit-any */

declare const global: any;

const MockGainNode: any = {
  gain: { value: 1 },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect(..._args: any[]): any {
    return this;
  },
  disconnect(): void {},
};

function MockAudioContext(this: any): void {
  this.sampleRate = 44100;
  this.baseLatency = 0;
  this.destination = {};
}

MockAudioContext.prototype.close = function(): Promise<void> {
  return Promise.resolve();
};

MockAudioContext.prototype.createGain = function(): any {
  return MockGainNode;
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
