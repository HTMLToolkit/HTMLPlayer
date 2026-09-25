const CHANNEL_CAP = 2;

class FloStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.channels = CHANNEL_CAP;
    this.data = new Float32Array(0);
    this.frames = 0;
    this.writePos = 0;
    this.playhead = 0;
    this.rate = 1;
    this.playing = false;
    this.endOfStream = false;
    this.endedSent = false;
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  ensureCapacity(extraSamples) {
    const needed = this.writePos + extraSamples;
    if (needed <= this.data.length) return;
    let size = this.data.length * 2 || 16384;
    while (size < needed) size *= 2;
    const next = new Float32Array(size);
    next.set(this.data.subarray(0, this.writePos), 0);
    this.data = next;
  }

  handleMessage(msg) {
    switch (msg.type) {
      case "configure": {
        this.channels = Math.min(CHANNEL_CAP, Math.max(1, msg.channels | 0));
        break;
      }
      case "append": {
        const chunk = msg.data;
        if (!chunk || chunk.length === 0) break;
        this.ensureCapacity(chunk.length);
        this.data.set(chunk, this.writePos);
        this.writePos += chunk.length;
        this.frames += chunk.length / this.channels;
        break;
      }
      case "endOfStream": {
        this.endOfStream = true;
        break;
      }
      case "play": {
        this.rate = msg.rate && msg.rate > 0.1 ? msg.rate : 1;
        this.playing = true;
        break;
      }
      case "rate": {
        if (msg.rate && msg.rate > 0.1) this.rate = msg.rate;
        break;
      }
      case "pause": {
        this.playing = false;
        break;
      }
      case "flush": {
        this.data = new Float32Array(0);
        this.writePos = 0;
        this.frames = 0;
        this.playhead = 0;
        this.endOfStream = false;
        this.endedSent = false;
        this.playing = false;
        break;
      }
      default:
        break;
    }
  }

  writeOutput(output) {
    const outL = output[0];
    const outR = output[1];
    const framesOut = outL.length;
    const channels = this.channels;

    for (let i = 0; i < framesOut; i++) {
      const pos = this.playhead;
      const idx = Math.floor(pos);
      if (idx + 1 >= this.frames) {
        outL.fill(0, i);
        if (outR) outR.fill(0, i);
        break;
      }
      const frac = pos - idx;
      const base = idx * channels;
      for (let ch = 0; ch < CHANNEL_CAP; ch++) {
        const srcCh = channels === 1 ? 0 : ch;
        const v0 = this.data[base + srcCh] ?? 0;
        const v1 = this.data[base + channels + srcCh] ?? 0;
        const mixed = v0 + (v1 - v0) * frac;
        if (ch === 0) outL[i] = mixed;
        else if (outR) outR[i] = mixed;
      }
      this.playhead += this.rate;
    }

    if (this.playing && this.endOfStream && this.playhead + 1 >= this.frames) {
      if (!this.endedSent) {
        this.endedSent = true;
        this.port.postMessage({ type: "ended" });
      }
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output) return true;
    const outL = output[0];
    if (!outL) return true;
    const outR = output[1];

    if (!this.playing) {
      outL.fill(0);
      if (outR) outR.fill(0);
      return true;
    }

    this.writeOutput(output);
    return true;
  }
}

registerProcessor("flo-stream-output", FloStreamProcessor);
