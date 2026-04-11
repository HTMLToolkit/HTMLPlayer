import type { IAudioBackend, AudioBackendOptions } from "../index";
import { createHTMLBackend, HTMLAudioBackend } from "./HTMLBackend";
import { createWebAudioBackend, WebAudioBackend } from "./WebAudioBackend";
import { createPitchBackend, PitchBackend } from "./PitchBackend";
import { createFloBackend, FloBackend } from "./FloBackend";
import { createHybridBackend, HybridBackend } from "./HybridBackend";
import type { Track } from "../../../core/engine/types";

const FLO_MIME_TYPES = ["audio/x-flo", "audio/flac", "audio/wav"];

export const isFloTrack = (track: Track): boolean => {
  if (track.mimeType && FLO_MIME_TYPES.includes(track.mimeType)) {
    return true;
  }
  if (track.url.includes(".flo")) {
    return true;
  }
  return false;
};

export const needsFloBackend = (track: Track): boolean => {
  return isFloTrack(track);
};

export const needsWebAudio = (track: Track): boolean => {
  return isFloTrack(track);
};

export class AudioBackendManager {
  private htmlBackend: HTMLAudioBackend | null = null;
  private webAudioBackend: WebAudioBackend | null = null;
  private pitchBackend: PitchBackend | null = null;
  private currentBackend: IAudioBackend | null = null;
  private options: AudioBackendOptions;

  constructor(options: AudioBackendOptions = { type: "hybrid" }) {
    this.options = options;
  }

  getBackendForTrack(track: Track): IAudioBackend {
    switch (this.options.type) {
      case "html":
        return this.getHTMLBackend();
      case "webaudio":
        return this.getWebAudioBackend();
      case "hybrid":
      default:
        return needsWebAudio(track)
          ? this.getWebAudioBackend()
          : this.getHTMLBackend();
    }
  }

  getHTMLBackend(): HTMLAudioBackend {
    if (!this.htmlBackend) {
      this.htmlBackend = new HTMLAudioBackend();
    }
    return this.htmlBackend;
  }

  getWebAudioBackend(): WebAudioBackend {
    if (!this.webAudioBackend) {
      this.webAudioBackend = new WebAudioBackend();
    }
    return this.webAudioBackend;
  }

  getPitchBackend(inner?: IAudioBackend): PitchBackend {
    if (!this.pitchBackend) {
      this.pitchBackend = createPitchBackend(inner);
    }
    return this.pitchBackend;
  }

  setBackend(backend: IAudioBackend): void {
    this.currentBackend = backend;
  }

  getCurrentBackend(): IAudioBackend | null {
    return this.currentBackend;
  }

  dispose(): void {
    this.htmlBackend?.dispose();
    this.webAudioBackend?.dispose();
    this.pitchBackend?.dispose();
    this.htmlBackend = null;
    this.webAudioBackend = null;
    this.pitchBackend = null;
    this.currentBackend = null;
  }
}

export function createBackendManager(
  options?: Partial<AudioBackendOptions>,
): AudioBackendManager {
  return new AudioBackendManager({
    type: "hybrid",
    ...options,
  } as AudioBackendOptions);
}

export {
  HTMLAudioBackend,
  WebAudioBackend,
  PitchBackend,
  FloBackend,
  HybridBackend,
};
export {
  createHTMLBackend,
  createWebAudioBackend,
  createPitchBackend,
  createFloBackend,
  createHybridBackend,
};
