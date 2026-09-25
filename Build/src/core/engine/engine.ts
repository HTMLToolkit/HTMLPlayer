import type {
  Track,
  Playlist,
  EngineSettings,
  EngineState,
  PlayerState,
  EngineEventMap,
  EngineError,
  RepeatMode,
} from "./types";
import { KomorebiEvents } from "./events";
import { StateMachine } from "./state";
import {
  QueueManager,
  type WeightedRandomizer,
  type ShuffleMode,
} from "./queue";
import { Scheduler } from "./scheduler";
import { AsyncOp } from "./asyncOp";
import { assertNever } from "./invariants";
import type { IAudioBackend } from "../../platform/audio";
import type { PreloadManager } from "../../platform/audio/preloader";
import { clampRate, clampVolume } from "../../platform/audio/clamp";

export interface IAudioEngineConfig {
  crossfade: {
    enabled: boolean;
    duration: number;
    shape: "none" | "linear" | "equalpower";
  };
  gapless: {
    enabled: boolean;
  };
  smartShuffle: boolean;
  autoPlayNext: boolean;
  trackResolver?: (track: Track) => Promise<Track>;
  preloadManager?: PreloadManager;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  volume: 1,
  crossfade: 0,
  crossfadeBeforeGapless: 3000,
  autoPlayNext: true,
  tempo: 1,
  pitch: 0,
  gaplessPlayback: true,
  smartShuffle: true,
  repeat: "off",
  defaultShuffle: false,
  defaultRepeat: "off",
};

export class KomorebiEngine {
  private events = new KomorebiEvents();
  private stateMachine = new StateMachine();
  private queue = new QueueManager();
  private scheduler = new Scheduler();

  private backend: IAudioBackend;
  private settings: EngineSettings = { ...DEFAULT_ENGINE_SETTINGS };
  private currentTime = 0;
  private duration = 0;
  private currentError: EngineError | null = null;
  private currentPlaylist: Playlist | null = null;

  private timeUpdateInterval: number | null = null;
  private scheduledTransitionId: number | null = null;

  private readonly loadOp = new AsyncOp();
  private readonly trackResolver:
    ((track: Track) => Promise<Track>) | undefined;
  private readonly preloadManager: PreloadManager | null;
  private prefetchSentinel = false;

  constructor(backend: IAudioBackend, config?: Partial<IAudioEngineConfig>) {
    this.backend = backend;
    this.trackResolver = config?.trackResolver;
    this.preloadManager = config?.preloadManager ?? null;
    this.backend.onTimeUpdate((time) => {
      this.handleTimeUpdate(time);
    });
    this.backend.onEnded(() => {
      this.handleTrackEnded();
    });
    this.backend.onError((error) => {
      this.handleError(error);
    });

    if (config?.crossfade) {
      this.scheduler.setCrossfadeConfig({
        enabled: config.crossfade.enabled,
        duration: config.crossfade.duration,
        shape: config.crossfade.shape,
      });
      this.settings.crossfade = config.crossfade.duration;
    }

    if (config?.gapless) {
      this.scheduler.setGaplessConfig({ enabled: config.gapless.enabled });
      this.settings.gaplessPlayback = config.gapless.enabled;
    }

    if (config?.smartShuffle !== undefined) {
      this.settings.smartShuffle = config.smartShuffle;
    }

    if (config?.autoPlayNext !== undefined) {
      this.settings.autoPlayNext = config.autoPlayNext;
    }
  }

  setWeightedRandomizer(randomizer: WeightedRandomizer | null): void {
    this.queue.setWeightedRandomizer(randomizer);
    if (this.settings.smartShuffle) {
      this.queue.setShuffleMode("smart");
    }
  }

  setShuffleMode(mode: ShuffleMode): void {
    this.queue.setShuffleMode(mode);
    this.settings.smartShuffle = mode === "smart";
    this.events.emit("settingschange", {
      settings: { smartShuffle: this.settings.smartShuffle },
    });
  }

  getShuffleMode(): ShuffleMode {
    return this.queue.getShuffleMode();
  }

  async load(track: Track, playlist?: Playlist): Promise<void> {
    if (playlist) {
      this.queue.setPlaylist(playlist);
      this.currentPlaylist = playlist;
    } else if (this.queue.getTracks().findIndex((t) => t.id === track.id) < 0) {
      const solo: Playlist = {
        id: `solo:${track.id}`,
        name: track.title,
        songs: [track],
      };
      this.queue.setPlaylist(solo);
      this.currentPlaylist = solo;
    }

    const previousTrack = this.queue.getCurrentTrack();

    const trackIndex = this.queue
      .getTracks()
      .findIndex((t) => t.id === track.id);
    this.queue.jumpToIndex(trackIndex >= 0 ? trackIndex : null);
    this.emitTrackChange(previousTrack, track);

    this.stateMachine.transition("loading");
    this.currentError = null;
    this.events.emit("loading", { track });

    const generation = this.loadOp.next();

    let target: Track;
    try {
      target = await this.resolveSource(track);
    } catch (error) {
      if (this.loadOp.isCurrent(generation)) {
        this.emitError(
          "LOAD_SOURCE_ERROR",
          `resolve source: ${String(error)}`,
          track,
        );
      }
      return;
    }

    return new Promise<void>((resolve) => {
      if (!this.loadOp.isCurrent(generation)) {
        resolve();
        return;
      }

      if (typeof target.url !== "string" || target.url.length === 0) {
        this.emitError(
          "LOAD_SOURCE_ERROR",
          `no playable source (url=${String(target.url)})`,
          track,
        );
        resolve();
        return;
      }

      this.backend
        .load(target.url, target)
        .then(() => {
          if (!this.loadOp.isCurrent(generation)) {
            resolve();
            return;
          }
          this.prefetchSentinel = false;
          this.backend.setReplayGain?.(this.replayGainForTrack(target));
          this.duration = this.backend.getDuration() ?? track.duration;
          this.stateMachine.transition("ready");
          this.events.emit("durationchange", { duration: this.duration });
          this.events.emit("ready", { track });
          this.emitStateChange();
          this.prefetchUpcoming(target);
          resolve();
        })
        .catch((error) => {
          if (!this.loadOp.isCurrent(generation)) {
            resolve();
            return;
          }
          this.prefetchSentinel = false;
          this.emitError("LOAD_ERROR", error.message, track);
          resolve();
        });
    });
  }

  async play(): Promise<void> {
    try {
      const state = this.stateMachine.getState();

      if (state === "idle" || state === "error") {
        const current = this.queue.getCurrentTrack();
        if (!current) return;

        this.load(current);
        const generation = this.loadOp.peek();
        await this.waitForState("ready");
        if (!this.loadOp.isCurrent(generation)) return;
        await this.play();
        return;
      }

      if (state !== "ready" && state !== "paused") return;

      const generation = this.loadOp.peek();
      await this.backend.play();
      if (!this.loadOp.isCurrent(generation)) return;

      this.stateMachine.transition("playing");
      this.startTimeUpdates();
      this.emitStateChange();

      const track = this.queue.getCurrentTrack();
      if (track) {
        this.queue.updateHistory(track.id);
      }
    } catch (error) {
      this.emitError("PLAY_ERROR", (error as Error).message);
    }
  }

  pause(): void {
    if (this.stateMachine.isPlaying()) {
      this.backend.pause();
      this.stateMachine.transition("paused");
      this.stopTimeUpdates();
      this.emitStateChange();
    }
  }

  stop(): void {
    if (this.stateMachine.isIdle()) return;
    this.loadOp.invalidate();
    this.backend.stop();
    this.backend.setReplayGain?.(null);
    this.prefetchSentinel = false;
    this.cancelScheduledTransition();
    this.stateMachine.transition("idle");
    this.currentTime = 0;
    this.currentError = null;
    this.stopTimeUpdates();
    this.emitStateChange();
  }

  async next(): Promise<void> {
    this.cancelScheduledTransition();

    const nextCursor = this.queue.peekNextCursor(this.settings.smartShuffle);

    switch (nextCursor.kind) {
      case "empty":
        break;
      case "active": {
        const nextTrack = this.queue.getTracks()[nextCursor.index];
        if (nextTrack === undefined) break;

        try {
          if (this.stateMachine.isPlaying()) {
            await this.loadAndPlay(nextTrack);
          } else {
            await this.load(nextTrack);
          }
        } catch (error) {
          this.emitError("NEXT_ERROR", (error as Error).message, nextTrack);
        }
        break;
      }
      default:
        assertNever(nextCursor);
    }
  }

  async previous(): Promise<void> {
    this.cancelScheduledTransition();

    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }

    const prevCursor = this.queue.peekPreviousCursor(
      this.settings.smartShuffle,
    );

    switch (prevCursor.kind) {
      case "empty":
        break;
      case "active": {
        const prevTrack = this.queue.getTracks()[prevCursor.index];
        if (prevTrack === undefined) break;

        try {
          if (this.stateMachine.isPlaying()) {
            await this.loadAndPlay(prevTrack);
          } else {
            await this.load(prevTrack);
          }
        } catch (error) {
          this.emitError("PREV_ERROR", (error as Error).message, prevTrack);
        }
        break;
      }
      default:
        assertNever(prevCursor);
    }
  }

  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this.duration));
    this.backend.seek(clampedTime);
    this.currentTime = clampedTime;
    this.emitTimeUpdate();
  }

  setVolume(volume: number): void {
    const clamped = clampVolume(volume);
    this.settings.volume = clamped;

    this.backend.setVolume(clamped);

    this.events.emit("volumechange", { volume: clamped });
  }

  setTempo(tempo: number): void {
    const clamped = clampRate(tempo);
    this.settings.tempo = clamped;

    this.backend.setPlaybackRate(clamped);

    this.events.emit("settingschange", { settings: { tempo: clamped } });
  }

  setPitch(semitones: number): void {
    this.settings.pitch = semitones;
    this.events.emit("settingschange", { settings: { pitch: semitones } });

    void this.backend.setPitch?.(semitones);
  }

  toggleShuffle(): void {
    if (this.queue.isShuffled()) {
      this.queue.unshuffle();
    } else {
      this.queue.shuffle(true);
    }

    this.settings.defaultShuffle = this.queue.isShuffled();
    this.events.emit("queuechange", { queue: this.queue.getState() });
  }

  setShuffle(shuffled: boolean): void {
    if (shuffled && !this.queue.isShuffled()) {
      this.queue.shuffle(true);
    } else if (!shuffled && this.queue.isShuffled()) {
      this.queue.unshuffle();
    }

    this.settings.defaultShuffle = shuffled;
    this.events.emit("queuechange", { queue: this.queue.getState() });
  }

  setRepeat(mode: RepeatMode): void {
    this.settings.repeat = mode;
    this.events.emit("settingschange", {
      settings: { repeat: mode },
    });
  }

  setAutoPlayNext(enabled: boolean): void {
    this.settings.autoPlayNext = enabled;
    this.events.emit("settingschange", {
      settings: { autoPlayNext: enabled },
    });
  }

  toggleRepeat(): void {
    const current = this.settings.repeat;
    this.settings.repeat =
      current === "off" ? "all" : current === "all" ? "one" : "off";
    this.events.emit("settingschange", {
      settings: { repeat: this.settings.repeat },
    });
  }

  setCrossfade(duration: number): void {
    this.settings.crossfade = duration;
    this.scheduler.setCrossfadeConfig({ enabled: duration > 0, duration });
    this.events.emit("settingschange", { settings: { crossfade: duration } });
  }

  setGapless(enabled: boolean): void {
    this.settings.gaplessPlayback = enabled;
    this.scheduler.setGaplessConfig({ enabled });
    this.events.emit("settingschange", {
      settings: { gaplessPlayback: enabled },
    });
  }

  updateSettings(newSettings: Partial<EngineSettings>): void {
    Object.assign(this.settings, newSettings);

    if (newSettings.volume !== undefined) {
      this.setVolume(newSettings.volume);
    }
    if (newSettings.tempo !== undefined) {
      this.setTempo(newSettings.tempo);
    }
    if (newSettings.crossfade !== undefined) {
      this.setCrossfade(newSettings.crossfade);
    }
    if (newSettings.gaplessPlayback !== undefined) {
      this.setGapless(newSettings.gaplessPlayback);
    }
    if (newSettings.pitch !== undefined) {
      this.setPitch(newSettings.pitch);
    }
    if (newSettings.smartShuffle !== undefined) {
      this.setShuffleMode(newSettings.smartShuffle ? "smart" : "random");
    }
    if (newSettings.repeat !== undefined) {
      this.setRepeat(newSettings.repeat);
    }

    this.events.emit("settingschange", { settings: newSettings });
  }

  setPlaylist(playlist: Playlist): void {
    this.queue.setPlaylist(playlist, false);
    this.currentPlaylist = playlist;
    this.events.emit("queuechange", { queue: this.queue.getState() });
  }

  getState(): EngineState {
    return {
      state: this.stateMachine.getState(),
      currentTrack: this.queue.getCurrentTrack(),
      currentPlaylist: this.currentPlaylist,
      queue: this.queue.getState(),
      settings: { ...this.settings },
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.settings.volume,
      playHistory: this.queue.getAllHistory(),
      error: this.currentError,
    };
  }

  getCurrentTrack(): Track | null {
    return this.queue.getCurrentTrack();
  }

  getQueue(): QueueManager {
    return this.queue;
  }

  getAnalyser(): AnalyserNode | null {
    return this.backend.getAnalyser?.() ?? null;
  }

  getScheduler(): Scheduler {
    return this.scheduler;
  }

  on<E extends keyof EngineEventMap>(
    event: E,
    callback: (data: EngineEventMap[E]) => void,
  ): void {
    this.events.on(event, callback);
  }

  off<E extends keyof EngineEventMap>(
    event: E,
    callback: (data: EngineEventMap[E]) => void,
  ): void {
    this.events.off(event, callback);
  }

  dispose(): void {
    this.stopTimeUpdates();
    this.cancelScheduledTransition();
    this.backend.dispose();
    this.events.removeAllListeners();
    this.stateMachine.reset();
  }

  private async loadAndPlay(track: Track): Promise<void> {
    await this.load(track);
    await this.play();
  }

  private async waitForState(
    targetState: PlayerState,
    timeout = 5000,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.events.off("statechange", onStateChange);
        reject(new Error(`Timeout waiting for state: ${targetState}`));
      }, timeout);

      const onStateChange = () => {
        if (settled) return;
        if (this.stateMachine.getState() === targetState) {
          settled = true;
          clearTimeout(timeoutId);
          this.events.off("statechange", onStateChange);
          resolve();
        } else if (this.stateMachine.hasError()) {
          settled = true;
          clearTimeout(timeoutId);
          this.events.off("statechange", onStateChange);
          const reason = this.currentError
            ? `Engine entered error state: ${this.currentError.code}`
            : "Engine entered error state";
          reject(new Error(reason));
        }
      };

      if (this.stateMachine.getState() === targetState) {
        onStateChange();
        return;
      }
      if (this.stateMachine.hasError()) {
        onStateChange();
        return;
      }

      this.events.on("statechange", onStateChange);
    });
  }

  private handleTimeUpdate(time: number): void {
    this.currentTime = time;

    if (this.stateMachine.isPlaying()) {
      this.checkScheduledTransition(time);
      this.maybePrefetchDuringPlayback();
    }

    this.emitTimeUpdate();
  }

  private maybePrefetchDuringPlayback(): void {
    if (this.prefetchSentinel || !this.preloadManager) return;
    if (!this.scheduler.shouldPreload(this.currentTime, this.duration)) return;

    this.prefetchSentinel = true;
    const track = this.queue.getCurrentTrack();
    if (track) {
      this.prefetchUpcoming(track);
    }
  }

  private prefetchUpcoming(track: Track): void {
    const preloadManager = this.preloadManager;
    if (!preloadManager) return;

    const tracks = this.queue.getTracks();
    const index = tracks.findIndex((candidate) => candidate.id === track.id);
    if (index < 0) return;

    preloadManager.preloadNext(tracks, index);
  }

  private async resolveSource(track: Track): Promise<Track> {
    const preloadedUrl = this.preloadManager?.getUrl(track.id);
    if (preloadedUrl) {
      return { ...track, url: preloadedUrl };
    }
    return this.trackResolver ? await this.trackResolver(track) : track;
  }

  private replayGainForTrack(track: Track): number | null {
    const replayGain = track.replayGain;
    if (!replayGain) return null;

    const gainDb = replayGain.trackGain ?? replayGain.albumGain;
    return typeof gainDb === "number" && Number.isFinite(gainDb)
      ? gainDb
      : null;
  }

  private checkScheduledTransition(currentTime: number): void {
    const track = this.queue.getCurrentTrack();
    if (!track) return;

    if (this.scheduler.shouldTriggerTransition(currentTime, track)) {
      this.scheduleTransition(track);
    }
  }

  private scheduleTransition(_track: Track): void {
    if (this.scheduledTransitionId !== null) return;

    this.stateMachine.transition("transitioning");

    const nextTrack = this.queue.getNextTrack(this.settings.smartShuffle);
    if (!nextTrack) return;

    const delay =
      this.scheduler.getMode() === "gapless" ? 100 : this.settings.crossfade;

    this.scheduledTransitionId = window.setTimeout(() => {
      this.scheduledTransitionId = null;
      this.executeTransition(nextTrack);
    }, delay);
  }

  private async executeTransition(nextTrack: Track): Promise<void> {
    const currentTrack = this.queue.getCurrentTrack();

    await this.loadAndPlay(nextTrack);

    if (currentTrack) {
      this.events.emit("ended", { track: currentTrack });
    }

    if (this.stateMachine.canTransition("playing")) {
      this.stateMachine.transition("playing");
    }
  }

  private cancelScheduledTransition(): void {
    if (this.scheduledTransitionId !== null) {
      clearTimeout(this.scheduledTransitionId);
      this.scheduledTransitionId = null;
    }

    if (this.stateMachine.isTransitioning()) {
      this.stateMachine.transition("ready");
    }
  }

  private handleTrackEnded(): void {
    const track = this.queue.getCurrentTrack();
    if (track) {
      this.events.emit("ended", { track: track });
    }

    if (this.settings.repeat === "one") {
      this.seek(0);
      this.play();
      return;
    }

    if (this.stateMachine.isTransitioning()) {
      return;
    }

    if (this.settings.autoPlayNext) {
      this.next();
    } else if (this.stateMachine.canTransition("ready")) {
      this.stateMachine.transition("ready");
      this.emitStateChange();
    }
  }

  private handleError(error: Error): void {
    this.emitError("BACKEND_ERROR", error.message);
  }

  private startTimeUpdates(): void {
    if (this.timeUpdateInterval) return;

    this.timeUpdateInterval = window.setInterval(() => {
      if (this.stateMachine.isPlaying()) {
        this.handleTimeUpdate(this.backend.getCurrentTime());
      }
    }, 100);
  }

  private stopTimeUpdates(): void {
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  private emitStateChange(): void {
    const prevState = this.stateMachine.getPreviousState();
    const newState = this.stateMachine.getState();
    this.events.emit("statechange", {
      oldState: prevState ?? "idle",
      newState,
    });
  }

  private emitTrackChange(from: Track | null, to: Track | null): void {
    this.events.emit("trackchange", { from, to });
  }

  private emitTimeUpdate(): void {
    this.events.emit("timeupdate", {
      currentTime: this.currentTime,
      duration: this.duration,
    });
  }

  private emitError(code: string, message: string, track?: Track): void {
    this.currentError = { code, message, track };
    if (this.stateMachine.canTransition("error")) {
      this.stateMachine.transition("error");
    }
    this.events.emit("error", { error: this.currentError });
    this.emitStateChange();
  }
}
