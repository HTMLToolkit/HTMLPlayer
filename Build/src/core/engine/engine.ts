import type {
  Track,
  Playlist,
  EngineSettings,
  EngineState,
  PlayerState,
  EngineEventMap,
  EngineError,
} from "./types";
import { KomorebiEvents } from "./events";
import { StateMachine } from "./state";
import { QueueManager } from "./queue";
import { Scheduler, CrossfadeScheduler, GaplessScheduler } from "./scheduler";

export interface IAudioBackend {
  load(url: string): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  onTimeUpdate(callback: (time: number) => void): void;
  onEnded(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  dispose(): void;
}

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
}

const DEFAULT_SETTINGS: EngineSettings = {
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

  private backend: IAudioBackend | null = null;
  private settings: EngineSettings = { ...DEFAULT_SETTINGS };
  private currentTime = 0;
  private duration = 0;
  private currentError: EngineError | null = null;

  private timeUpdateInterval: number | null = null;
  private scheduledTransitionId: number | null = null;

  constructor(config?: Partial<IAudioEngineConfig>) {
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

  setBackend(backend: IAudioBackend): void {
    if (this.backend) {
      this.backend.dispose();
    }
    this.backend = backend;

    this.backend.onTimeUpdate((time) => {
      this.handleTimeUpdate(time);
    });

    this.backend.onEnded(() => {
      this.handleTrackEnded();
    });

    this.backend.onError((error) => {
      this.handleError(error);
    });
  }

  load(track: Track, playlist?: Playlist): void {
    if (!this.backend) {
      this.emitError("NO_BACKEND", "No audio backend configured");
      return;
    }

    if (playlist) {
      this.queue.setPlaylist(playlist);
    }

    this.queue.setCurrentIndex(
      this.queue.getTracks().findIndex((t) => t.id === track.id)
    );

    this.stateMachine.transition("loading");
    this.currentError = null;

    this.backend
      .load(track.url)
      .then(() => {
        this.duration = this.backend?.getDuration() ?? track.duration;
        this.stateMachine.transition("ready");
        this.emitStateChange();
      })
      .catch((error) => {
        this.emitError("LOAD_ERROR", error.message, track);
      });
  }

  async play(): Promise<void> {
    if (!this.backend) {
      this.emitError("NO_BACKEND", "No audio backend configured");
      return;
    }

    const state = this.stateMachine.getState();

    if (state === "idle" || state === "error") {
      const current = this.queue.getCurrentTrack();
      if (current) {
        this.load(current);
        await this.waitForState("ready");
        await this.play();
        return;
      }
      return;
    }

    if (state === "ready" || state === "paused") {
      try {
        await this.backend.play();
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
  }

  pause(): void {
    if (!this.backend) return;

    if (this.stateMachine.isPlaying()) {
      this.backend.pause();
      this.stateMachine.transition("paused");
      this.stopTimeUpdates();
      this.emitStateChange();
    }
  }

  stop(): void {
    if (!this.backend) return;

    this.backend.stop();
    this.stateMachine.transition("idle");
    this.currentTime = 0;
    this.stopTimeUpdates();
    this.emitStateChange();
  }

  async next(): Promise<void> {
    this.cancelScheduledTransition();

    const nextTrack = this.queue.getNextTrack(this.settings.smartShuffle);
    if (nextTrack) {
      const currentTrack = this.queue.getCurrentTrack();
      this.queue.setCurrentIndex(this.queue.getNextIndex(this.settings.smartShuffle));

      if (this.stateMachine.isPlaying()) {
        this.loadAndPlay(nextTrack);
      } else {
        this.load(nextTrack);
      }

      this.emitTrackChange(currentTrack, nextTrack);
    } else if (this.settings.repeat === "all") {
      this.queue.setCurrentIndex(-1);
      const firstTrack = this.queue.getNextTrack(this.settings.smartShuffle);
      if (firstTrack) {
        this.loadAndPlay(firstTrack);
        this.emitTrackChange(null, firstTrack);
      }
    }
  }

  async previous(): Promise<void> {
    this.cancelScheduledTransition();

    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }

    const prevTrack = this.queue.getPreviousTrack(this.settings.smartShuffle);
    if (prevTrack) {
      const currentTrack = this.queue.getCurrentTrack();
      this.queue.setCurrentIndex(this.queue.getPreviousIndex(this.settings.smartShuffle));

      if (this.stateMachine.isPlaying()) {
        this.loadAndPlay(prevTrack);
      } else {
        this.load(prevTrack);
      }

      this.emitTrackChange(currentTrack, prevTrack);
    }
  }

  seek(time: number): void {
    if (!this.backend) return;

    const clampedTime = Math.max(0, Math.min(time, this.duration));
    this.backend.seek(clampedTime);
    this.currentTime = clampedTime;
    this.emitTimeUpdate();
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.settings.volume = clamped;

    if (this.backend) {
      this.backend.setVolume(clamped);
    }

    this.events.emit("volumechange", { volume: clamped });
  }

  setTempo(tempo: number): void {
    const clamped = Math.max(0.25, Math.min(4, tempo));
    this.settings.tempo = clamped;

    if (this.backend) {
      this.backend.setPlaybackRate(clamped);
    }

    this.events.emit("settingschange", { settings: { tempo: clamped } });
  }

  setPitch(semitones: number): void {
    this.settings.pitch = semitones;
    this.events.emit("settingschange", { settings: { pitch: semitones } });
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

  toggleRepeat(): void {
    const current = this.settings.repeat;
    this.settings.repeat = current === "off" ? "all" : current === "all" ? "one" : "off";
    this.events.emit("settingschange", { settings: { repeat: this.settings.repeat } });
  }

  setCrossfade(duration: number): void {
    this.settings.crossfade = duration;
    this.scheduler.setCrossfadeConfig({ enabled: duration > 0, duration });
    this.events.emit("settingschange", { settings: { crossfade: duration } });
  }

  setGapless(enabled: boolean): void {
    this.settings.gaplessPlayback = enabled;
    this.scheduler.setGaplessConfig({ enabled });
    this.events.emit("settingschange", { settings: { gaplessPlayback: enabled } });
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

    this.events.emit("settingschange", { settings: newSettings });
  }

  setPlaylist(playlist: Playlist): void {
    this.queue.setPlaylist(playlist, false);
    this.events.emit("queuechange", { queue: this.queue.getState() });
  }

  getState(): EngineState {
    return {
      state: this.stateMachine.getState(),
      currentTrack: this.queue.getCurrentTrack(),
      currentPlaylist: null,
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

  getScheduler(): Scheduler {
    return this.scheduler;
  }

  on<E extends keyof EngineEventMap>(
    event: E,
    callback: (data: EngineEventMap[E]) => void
  ): void {
    this.events.on(event, callback);
  }

  off<E extends keyof EngineEventMap>(
    event: E,
    callback: (data: EngineEventMap[E]) => void
  ): void {
    this.events.off(event, callback);
  }

  dispose(): void {
    this.stopTimeUpdates();
    this.cancelScheduledTransition();
    this.backend?.dispose();
    this.events.removeAllListeners();
    this.stateMachine.reset();
  }

  private async loadAndPlay(track: Track): Promise<void> {
    return new Promise((resolve, reject) => {
      const onLoad = () => {
        this.backend?.off("ended", onLoad);
        this.play()
          .then(resolve)
          .catch(reject);
      };

      this.backend?.on("ended", onLoad);
      this.load(track);
    });
  }

  private async waitForState(targetState: PlayerState, timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkState = () => {
        if (this.stateMachine.getState() === targetState) {
          resolve();
          return true;
        }
        if (this.stateMachine.hasError()) {
          reject(new Error("State transition failed"));
          return true;
        }
        return false;
      };

      if (checkState()) return;

      const timeoutId = setTimeout(() => {
        this.events.off("statechange", stateHandler);
        reject(new Error(`Timeout waiting for state: ${targetState}`));
      }, timeout);

      const stateHandler = () => {
        if (checkState()) {
          clearTimeout(timeoutId);
        }
      };

      this.events.on("statechange", stateHandler);
    });
  }

  private handleTimeUpdate(time: number): void {
    this.currentTime = time;

    if (this.stateMachine.isPlaying()) {
      this.checkScheduledTransition(time);
    }

    this.emitTimeUpdate();
  }

  private checkScheduledTransition(currentTime: number): void {
    const track = this.queue.getCurrentTrack();
    if (!track) return;

    if (this.scheduler.shouldTriggerTransition(currentTime, track)) {
      this.scheduleTransition(track);
    }
  }

  private scheduleTransition(track: Track): void {
    if (this.scheduledTransitionId !== null) return;

    this.stateMachine.transition("transitioning");

    const nextTrack = this.queue.getNextTrack(this.settings.smartShuffle);
    if (!nextTrack) return;

    const delay = this.scheduler.getMode() === "gapless" ? 100 : this.settings.crossfade;

    this.scheduledTransitionId = window.setTimeout(() => {
      this.scheduledTransitionId = null;
      this.executeTransition(nextTrack);
    }, delay);
  }

  private executeTransition(nextTrack: Track): void {
    const currentTrack = this.queue.getCurrentTrack();
    this.queue.setCurrentIndex(this.queue.getNextIndex(this.settings.smartShuffle));

    this.load(nextTrack);
    this.play();

    this.emitTrackChange(currentTrack, nextTrack);

    if (currentTrack) {
      this.events.emit("ended", { track: currentTrack });
    }

    this.stateMachine.transition("playing");
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

    if (this.settings.autoPlayNext) {
      this.next();
    } else {
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
      if (this.backend && this.stateMachine.isPlaying()) {
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
    this.events.emit("statechange", { oldState: prevState ?? "idle", newState });
  }

  private emitTrackChange(from: Track | null, to: Track | null): void {
    this.events.emit("trackchange", { from, to });
  }

  private emitTimeUpdate(): void {
    this.events.emit("timeupdate", { currentTime: this.currentTime, duration: this.duration });
  }

  private emitError(code: string, message: string, track?: Track): void {
    this.currentError = { code, message, track };
    this.stateMachine.transition("error");
    this.events.emit("error", { error: this.currentError });
    this.emitStateChange();
  }
}