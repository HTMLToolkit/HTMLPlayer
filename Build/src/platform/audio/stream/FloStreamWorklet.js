const CHANNEL_CAP = 2;
const INITIAL_CAPACITY_FRAMES = 16384;
const DEFAULT_HIGH_WATERMARK_SECONDS = 2;
const DEFAULT_LOW_WATERMARK_SECONDS = 1;
const HARD_CAP_SECONDS = 4;

class FloStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.channels = CHANNEL_CAP;
    this.ctxRate = sampleRate || 44100;
    this.srcRate = this.ctxRate;
    this.capacity = INITIAL_CAPACITY_FRAMES;
    this.data = new Float32Array(this.capacity * this.channels);
    this.writeFrame = 0;
    this.readFrame = 0;
    this.playPos = 0;
    this.rate = 1;
    this.playing = false;
    this.endOfStream = false;
    this.endedSent = false;
    this.highWatermarkFrames = Math.round(
      DEFAULT_HIGH_WATERMARK_SECONDS * this.srcRate,
    );
    this.lowWatermarkFrames = Math.round(
      DEFAULT_LOW_WATERMARK_SECONDS * this.srcRate,
    );
    this.hardCapFrames = Math.round(HARD_CAP_SECONDS * this.srcRate);
    this.paused = false;
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  get resampleStep() {
    return this.rate * (this.srcRate / this.ctxRate);
  }

  get bufferedFrames() {
    return this.writeFrame - this.readFrame;
  }

  ensureWriteCapacity(frames) {
    const needed = this.bufferedFrames + frames;
    if (needed <= this.capacity) return;
    let size = this.capacity || INITIAL_CAPACITY_FRAMES;
    while (size < needed) size *= 2;

    const next = new Float32Array(size * this.channels);
    const live = this.bufferedFrames;
    const start = this.readFrame % this.capacity;
    let copied = 0;
    while (copied < live) {
      const offset = (start + copied) % this.capacity;
      const run = Math.min(live - copied, this.capacity - offset);
      const src = offset * this.channels;
      next.set(
        this.data.subarray(src, src + run * this.channels),
        (this.readFrame + copied) * this.channels,
      );
      copied += run;
    }
    this.data = next;
    this.capacity = size;
  }

  handleMessage(msg) {
    switch (msg.type) {
      case "configure": {
        const channels = Math.min(CHANNEL_CAP, Math.max(1, msg.channels | 0));
        if (channels !== this.channels) {
          this.reset();
          this.channels = channels;
          this.data = new Float32Array(this.capacity * this.channels);
        }
        this.srcRate = msg.sampleRate > 0 ? msg.sampleRate : this.srcRate;
        this.hardCapFrames = Math.round(HARD_CAP_SECONDS * this.srcRate);
        this.highWatermarkFrames = Math.min(
          this.highWatermarkFrames,
          this.hardCapFrames,
        );
        this.lowWatermarkFrames = Math.min(
          this.lowWatermarkFrames,
          this.highWatermarkFrames,
        );
        if (msg.highWatermarkSeconds > 0) {
          this.highWatermarkFrames = Math.round(
            msg.highWatermarkSeconds * this.srcRate,
          );
        }
        if (msg.lowWatermarkSeconds > 0) {
          this.lowWatermarkFrames = Math.round(
            msg.lowWatermarkSeconds * this.srcRate,
          );
        }
        break;
      }
      case "append": {
        const chunk = msg.data;
        if (!chunk || chunk.length === 0) break;
        const frames = Math.floor(chunk.length / this.channels);
        if (frames === 0) break;
        if (this.bufferedFrames + frames > this.hardCapFrames) {
          this.port.postMessage({
            type: "overflow",
            frames: this.bufferedFrames + frames,
            cap: this.hardCapFrames,
          });
        }
        this.ensureWriteCapacity(frames);
        let write = this.writeFrame % this.capacity;
        let read = 0;
        while (read < chunk.length) {
          const runFrames = Math.min(
            frames - read / this.channels,
            this.capacity - write,
          );
          const count = runFrames * this.channels;
          this.data.set(
            chunk.subarray(read, read + count),
            write * this.channels,
          );
          read += count;
          write = (write + runFrames) % this.capacity;
        }
        this.writeFrame += frames;
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
        this.reset();
        break;
      }
      default:
        break;
    }
  }

  reset() {
    this.writeFrame = 0;
    this.readFrame = 0;
    this.playPos = 0;
    this.endOfStream = false;
    this.endedSent = false;
    this.playing = false;
  }

  writeOutput(output) {
    const outL = output[0];
    const outR = output[1];
    const framesOut = outL.length;
    const channels = this.channels;
    const capacity = this.capacity;
    const step = this.resampleStep;

    for (let i = 0; i < framesOut; i++) {
      const floor = Math.floor(this.playPos);
      if (floor + 1 >= this.writeFrame) {
        outL.fill(0, i);
        if (outR) outR.fill(0, i);
        break;
      }
      const frac = this.playPos - floor;
      const base = (floor % capacity) * channels;
      const nextBase = ((floor + 1) % capacity) * channels;
      for (let ch = 0; ch < CHANNEL_CAP; ch++) {
        const srcCh = channels === 1 ? 0 : ch;
        const v0 = this.data[base + srcCh];
        const v1 = this.data[nextBase + srcCh];
        const mixed = v0 + (v1 - v0) * frac;
        if (ch === 0) outL[i] = mixed;
        else if (outR) outR[i] = mixed;
      }
      this.playPos += step;
    }
    this.readFrame = Math.floor(this.playPos);

    this.syncBackpressure();

    const drained =
      this.readFrame >= this.writeFrame ||
      (this.endOfStream && this.readFrame + 1 >= this.writeFrame);
    if (this.playing && drained && !this.endedSent) {
      this.endedSent = true;
      this.port.postMessage({ type: "ended" });
    }
  }

  syncBackpressure() {
    const buffered = this.bufferedFrames;
    if (!this.paused && buffered >= this.highWatermarkFrames) {
      this.paused = true;
      this.port.postMessage({ type: "level", paused: true });
    } else if (this.paused && buffered <= this.lowWatermarkFrames) {
      this.paused = false;
      this.port.postMessage({ type: "level", paused: false });
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
