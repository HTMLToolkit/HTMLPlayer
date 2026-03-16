import type { CrossfadeConfig, GaplessConfig, Track } from "../types";

export interface ScheduledTransition {
  type: "crossfade" | "gapless";
  fromTrack: Track;
  toTrack: Track;
  triggerTime: number;
  duration: number;
}

export type TransitionCurve = "linear" | "equalpower";

export class CrossfadeScheduler {
  private config: CrossfadeConfig = {
    enabled: false,
    duration: 3000,
    shape: "equalpower",
  };

  private activeTransition: ScheduledTransition | null = null;

  setConfig(config: Partial<CrossfadeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CrossfadeConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.duration > 0;
  }

  calculateTriggerTime(trackDuration: number, currentTime: number): number | null {
    if (!this.isEnabled()) return null;

    const durationSeconds = this.config.duration / 1000;
    if (trackDuration <= durationSeconds) return null;

    const triggerTime = trackDuration - durationSeconds;
    if (currentTime >= triggerTime) {
      return triggerTime;
    }
    return triggerTime;
  }

  shouldTrigger(currentTime: number, duration: number): boolean {
    if (!this.isEnabled()) return false;

    const triggerPoint = duration - this.config.duration;
    return currentTime >= triggerPoint;
  }

  getCurve(): TransitionCurve {
    return this.config.shape === "none" ? "linear" : this.config.shape;
  }

  calculateVolumes(progress: number): { fromVolume: number; toVolume: number } {
    const { shape } = this.config;
    const p = progress;

    let fromVolume: number;
    let toVolume: number;

    switch (shape) {
      case "equalpower":
        fromVolume = Math.cos(p * Math.PI / 2);
        toVolume = Math.sin(p * Math.PI / 2);
        break;
      case "linear":
        fromVolume = 1 - p;
        toVolume = p;
        break;
      default:
        fromVolume = 1;
        toVolume = 1;
    }

    return { fromVolume, toVolume };
  }

  createTransition(fromTrack: Track, toTrack: Track, duration: number): ScheduledTransition {
    return {
      type: "crossfade",
      fromTrack,
      toTrack,
      triggerTime: Date.now(),
      duration,
    };
  }

  setActiveTransition(transition: ScheduledTransition | null): void {
    this.activeTransition = transition;
  }

  getActiveTransition(): ScheduledTransition | null {
    return this.activeTransition;
  }

  clearActiveTransition(): void {
    this.activeTransition = null;
  }
}

export class GaplessScheduler {
  private config: GaplessConfig = {
    enabled: true,
    startOffset: 0,
    endOffset: 0,
  };

  setConfig(config: Partial<GaplessConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): GaplessConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getStartOffset(track: Track): number {
    return track.gapless?.encoderDelay ?? this.config.startOffset;
  }

  getEndOffset(track: Track): number {
    return track.gapless?.encoderPadding ?? this.config.endOffset;
  }

  shouldPreload(currentTime: number, duration: number): boolean {
    const preloadTime = 10;
    return duration - currentTime <= preloadTime;
  }

  calculatePlayEnd(track: Track): number {
    const offset = this.getEndOffset(track);
    return track.duration - offset;
  }

  shouldTransition(currentTime: number, track: Track): boolean {
    const playEnd = this.calculatePlayEnd(track);
    const threshold = 0.1;
    return currentTime >= playEnd - threshold;
  }
}

export class Scheduler {
  private crossfade: CrossfadeScheduler;
  private gapless: GaplessScheduler;
  private currentMode: "crossfade" | "gapless" | "none" = "none";

  constructor() {
    this.crossfade = new CrossfadeScheduler();
    this.gapless = new GaplessScheduler();
  }

  setCrossfadeConfig(config: Partial<CrossfadeConfig>): void {
    this.crossfade.setConfig(config);
    this.updateMode();
  }

  setGaplessConfig(config: Partial<GaplessConfig>): void {
    this.gapless.setConfig(config);
    this.updateMode();
  }

  private updateMode(): void {
    if (this.gapless.isEnabled() && this.gapless.getConfig().enabled) {
      this.currentMode = "gapless";
    } else if (this.crossfade.isEnabled()) {
      this.currentMode = "crossfade";
    } else {
      this.currentMode = "none";
    }
  }

  getMode(): "crossfade" | "gapless" | "none" {
    return this.currentMode;
  }

  shouldPreload(currentTime: number, duration: number): boolean {
    return this.gapless.shouldPreload(currentTime, duration);
  }

  shouldTriggerTransition(currentTime: number, track: Track): boolean {
    switch (this.currentMode) {
      case "crossfade":
        return this.crossfade.shouldTrigger(currentTime, track.duration);
      case "gapless":
        return this.gapless.shouldTransition(currentTime, track);
      default:
        return false;
    }
  }

  getTransitionParams(currentTime: number, track: Track): {
    triggerTime: number;
    duration: number;
  } | null {
    switch (this.currentMode) {
      case "crossfade":
        const triggerTime = this.crossfade.calculateTriggerTime(track.duration, currentTime);
        return triggerTime !== null
          ? { triggerTime, duration: this.crossfade.getConfig().duration }
          : null;
      case "gapless":
        const playEnd = this.gapless.calculatePlayEnd(track);
        return { triggerTime: playEnd - 10, duration: 0 };
      default:
        return null;
    }
  }

  getCrossfade(): CrossfadeScheduler {
    return this.crossfade;
  }

  getGapless(): GaplessScheduler {
    return this.gapless;
  }
}