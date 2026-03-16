class MockGainNode {
  gain = { value: 1 };
  disconnect() {}
  connect() {
    return this;
  }
}

class MockAudioContext {
  sampleRate = 44100;
  baseLatency = 0;
  close() {
    return Promise.resolve();
  }
  createGain() {
    return new MockGainNode();
  }
  createBufferSource() {
    return {
      buffer: null,
      connect: () => {},
      start: () => {},
      stop: () => {},
      onended: null,
      disconnect: () => {},
    };
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
  decodeAudioData(buffer: ArrayBuffer) {
    return Promise.resolve(this.createBuffer(2, 44100, 44100));
  }
  destination = {};
}

class MockAudio {
  src = "";
  currentTime = 0;
  duration = 0;
  paused = true;
  volume = 1;
  playbackRate = 1;
  readyState = 4;
  HAVE_ENOUGH_DATA = 4;

  play() {
    return Promise.resolve();
  }
  pause() {}
  load() {}
  addEventListener(_event: string, _callback: () => void) {}
  removeEventListener(_event: string, _callback: () => void) {}
  dispatchEvent(_event: unknown) {
    return true;
  }
}

(global as unknown as { AudioContext: typeof AudioContext }).AudioContext = MockAudioContext as unknown as typeof AudioContext;
(global as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext = MockAudioContext as unknown as typeof AudioContext;
(global as unknown as { Audio: typeof Audio }).Audio = MockAudio as unknown as typeof Audio;
