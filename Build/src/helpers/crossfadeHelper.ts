import i18n from "i18next";

export interface CrossfadeOptions {
  duration: number;
  curve?: "linear" | "exponential" | "smooth";
}

export interface AudioSource {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
  id: string;
}

/**
 * Validate and clamp pitch value
 */
function getValidPitch(pitch: number | undefined): number {
  if (typeof pitch !== "number" || !Number.isFinite(pitch)) {
    return 0; // Default to no pitch shift
  }
  // Clamp to -48 to +48 semitones
  return Math.max(-48, Math.min(48, pitch));
}

export class CrossfadeManager {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private analyzerNode: AnalyserNode;

  private currentSource: AudioSource | null = null;
  private nextSource: AudioSource | null = null;

  private crossfadeInProgress = false;
  private crossfadeTimeout: number | null = null;
  private crossfadePromise: Promise<void> | null = null;

  // Track which audio element is the "active" one for UI updates
  private activeElement: HTMLAudioElement | null = null;

  // Current pitch setting
  private currentPitch: number = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;

    // Create master gain node
    this.masterGain = audioContext.createGain();
    this.masterGain.connect(audioContext.destination);

    // Create analyzer for visualizations
    this.analyzerNode = audioContext.createAnalyser();
    this.analyzerNode.fftSize = 2048;
    this.masterGain.connect(this.analyzerNode);
  }

  /**
   * Create an audio source with proper Web Audio setup
   */
  createAudioSource(audioElement: HTMLAudioElement): AudioSource {
    // Check if this element already has an audio source
    const existingSource = (audioElement as any)._webAudioSource;
    if (existingSource && existingSource.source.mediaElement === audioElement) {
      return existingSource;
    }

    try {
      const source = this.audioContext.createMediaElementSource(audioElement);
      const gainNode = this.audioContext.createGain();

      // Connect: MediaElementSource -> GainNode -> MasterGain
      source.connect(gainNode);
      gainNode.connect(this.masterGain);

      const audioSource: AudioSource = {
        element: audioElement,
        source,
        gainNode,
        id: Math.random().toString(36).substr(2, 9),
      };

      // Store reference to prevent multiple sources for same element
      (audioElement as any)._webAudioSource = audioSource;

      return audioSource;
    } catch (error) {
      console.error("Failed to create audio source:", error);
      throw error;
    }
  }

  /**
   * Set the current playing source
   */
  setCurrentSource(source: AudioSource) {
    if (this.currentSource !== source) {
      this.currentSource = source;
      this.activeElement = source.element;

      // Set to full volume
      this.currentSource.gainNode.gain.setValueAtTime(
        1,
        this.audioContext.currentTime,
      );

      // Mute any previous sources
      if (this.nextSource && this.nextSource !== source) {
        this.nextSource.gainNode.gain.setValueAtTime(
          0,
          this.audioContext.currentTime,
        );
      }
    }
  }

  /**
   * Prepare the next source for crossfading
   */
  prepareNextSource(source: AudioSource) {
    this.nextSource = source;
    // Start muted
    this.nextSource.gainNode.gain.setValueAtTime(
      0,
      this.audioContext.currentTime,
    );
  }

  /**
   * Start crossfade from current to next source
   */
  async startCrossfade(options: CrossfadeOptions): Promise<void> {
    if (!this.currentSource || !this.nextSource) {
      throw new Error("Cannot start crossfade - missing audio sources");
    }

    if (this.crossfadeInProgress) {
      console.warn("Crossfade already in progress, cancelling previous");
      this.cancelCrossfade();
    }

    this.crossfadeInProgress = true;
    const { duration, curve = "smooth" } = options;
    const now = this.audioContext.currentTime;

    console.log("Starting crossfade transition...");

    this.crossfadePromise = new Promise<void>(async (resolve, reject) => {
      try {
        // Ensure next audio is ready to play
        if (this.nextSource!.element.readyState < 2) {
          await new Promise<void>((loadResolve, loadReject) => {
            const timeout = setTimeout(() => {
              loadReject(
                new Error(i18n.t("crossfade.nextAudioFailedToLoadInTime")),
              );
            }, 5000);

            const cleanup = () => {
              clearTimeout(timeout);
              this.nextSource!.element.removeEventListener("canplay", onReady);
              this.nextSource!.element.removeEventListener(
                "loadeddata",
                onReady,
              );
              this.nextSource!.element.removeEventListener("error", onError);
            };

            const onReady = () => {
              cleanup();
              loadResolve();
            };

            const onError = () => {
              cleanup();
              loadReject(new Error(i18n.t("crossfade.nextAudioFailedToLoad")));
            };

            this.nextSource!.element.addEventListener("canplay", onReady);
            this.nextSource!.element.addEventListener("loadeddata", onReady);
            this.nextSource!.element.addEventListener("error", onError);
          });
        }

        // Start playing the next audio element
        await this.nextSource!.element.play();

        // Set up crossfade curves
        this.setupCrossfadeCurves(duration, curve, now);

        // Switch active element immediately so UI shows the new song
        this.activeElement = this.nextSource!.element;

        // Listen for current song ending
        const handleCurrentEnded = () => {
          if (this.crossfadeInProgress) {
            console.log("Current song ended during crossfade");
            this.completeCrossfade();
            resolve();
          }
        };

        this.currentSource!.element.addEventListener(
          "ended",
          handleCurrentEnded,
          { once: true },
        );

        // Set timeout for crossfade completion
        this.crossfadeTimeout = window.setTimeout(
          () => {
            if (this.crossfadeInProgress) {
              this.currentSource!.element.removeEventListener(
                "ended",
                handleCurrentEnded,
              );
              this.completeCrossfade();
              resolve();
            }
          },
          duration * 1000 + 100,
        );
      } catch (error) {
        console.error("Crossfade failed:", error);
        this.crossfadeInProgress = false;
        this.clearCrossfadeTimeout();
        reject(error);
      }
    });

    return this.crossfadePromise;
  }

  /**
   * Set up crossfade curves using Web Audio gain automation
   */
  private setupCrossfadeCurves(
    duration: number,
    curve: string,
    startTime: number,
  ) {
    if (!this.currentSource || !this.nextSource) return;

    const currentGain = this.currentSource.gainNode.gain;
    const nextGain = this.nextSource.gainNode.gain;

    // Cancel any existing automation
    currentGain.cancelScheduledValues(startTime);
    nextGain.cancelScheduledValues(startTime);

    const endTime = startTime + duration;

    switch (curve) {
      case "linear":
        // Linear crossfade
        currentGain.setValueAtTime(1, startTime);
        currentGain.linearRampToValueAtTime(0, endTime);

        nextGain.setValueAtTime(0, startTime);
        nextGain.linearRampToValueAtTime(1, endTime);
        break;

      case "exponential":
        // Exponential crossfade (more natural for audio)
        currentGain.setValueAtTime(1, startTime);
        currentGain.exponentialRampToValueAtTime(0.001, endTime); // Can't ramp to exactly 0

        nextGain.setValueAtTime(0.001, startTime);
        nextGain.exponentialRampToValueAtTime(1, endTime);
        break;

      case "smooth":
      default:
        // Equal-power crossfade (best for music)
        const steps = 20;
        const stepDuration = duration / steps;

        for (let i = 0; i <= steps; i++) {
          const progress = i / steps;
          const time = startTime + i * stepDuration;

          // Equal-power curves: sqrt(1-x) and sqrt(x)
          const currentLevel = Math.sqrt(1 - progress);
          const nextLevel = Math.sqrt(progress);

          if (i === 0) {
            currentGain.setValueAtTime(currentLevel, time);
            nextGain.setValueAtTime(nextLevel, time);
          } else {
            currentGain.linearRampToValueAtTime(currentLevel, time);
            nextGain.linearRampToValueAtTime(nextLevel, time);
          }
        }
        break;
    }
  }

  /**
   * Complete the crossfade transition
   */
  private completeCrossfade() {
    if (!this.crossfadeInProgress) return;

    try {
      console.log("Completing crossfade transition");

      // Stop the old audio
      if (this.currentSource) {
        this.currentSource.element.pause();
        this.currentSource.element.currentTime = 0;
        this.currentSource.gainNode.gain.setValueAtTime(
          0,
          this.audioContext.currentTime,
        );
      }

      // Ensure next source is at full volume
      if (this.nextSource) {
        this.nextSource.gainNode.gain.setValueAtTime(
          1,
          this.audioContext.currentTime,
        );
      }

      // Swap sources
      this.currentSource = this.nextSource;
      this.nextSource = null;

      this.crossfadeInProgress = false;
      this.crossfadePromise = null;
      this.clearCrossfadeTimeout();
    } catch (error) {
      console.error("Error completing crossfade:", error);
      this.crossfadeInProgress = false;
    }
  }

  /**
   * Cancel an ongoing crossfade
   */
  cancelCrossfade() {
    if (!this.crossfadeInProgress) return;

    console.log("Cancelling crossfade");

    try {
      const now = this.audioContext.currentTime;

      // Stop any scheduled gain changes
      if (this.currentSource) {
        this.currentSource.gainNode.gain.cancelScheduledValues(now);
        this.currentSource.gainNode.gain.setValueAtTime(1, now);
      }

      if (this.nextSource) {
        this.nextSource.gainNode.gain.cancelScheduledValues(now);
        this.nextSource.gainNode.gain.setValueAtTime(0, now);
        this.nextSource.element.pause();
        this.nextSource.element.currentTime = 0;
      }

      // Reset active element to current source
      if (this.currentSource) {
        this.activeElement = this.currentSource.element;
      }

      this.crossfadeInProgress = false;
      this.crossfadePromise = null;
      this.clearCrossfadeTimeout();
    } catch (error) {
      console.error("Error cancelling crossfade:", error);
    }
  }

  /**
   * Clear crossfade timeout
   */
  private clearCrossfadeTimeout() {
    if (this.crossfadeTimeout) {
      clearTimeout(this.crossfadeTimeout);
      this.crossfadeTimeout = null;
    }
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    const now = this.audioContext.currentTime;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(clampedVolume, now + 0.1);
  }

  /**
   * Get the active audio element (for UI synchronization)
   */
  getActiveElement(): HTMLAudioElement | null {
    return this.activeElement;
  }

  /**
   * Check if crossfade is active
   */
  isCrossfading(): boolean {
    return this.crossfadeInProgress;
  }

  /**
   * Get master gain node for analyzer connections
   */
  getMasterGainNode(): GainNode {
    return this.masterGain;
  }

  /**
   * Get analyzer node for visualizations
   */
  getAnalyzerNode(): AnalyserNode {
    return this.analyzerNode;
  }

  /**
   * Seek the active audio element
   */
  seekTo(time: number) {
    if (this.activeElement) {
      this.activeElement.currentTime = time;
    }
  }

  /**
   * Get current time from active element
   */
  getCurrentTime(): number {
    return this.activeElement?.currentTime || 0;
  }

  /**
   * Get duration from active element
   */
  getDuration(): number {
    return this.activeElement?.duration || 0;
  }

  /**
   * Check if active element is playing
   */
  isPlaying(): boolean {
    return this.activeElement ? !this.activeElement.paused : false;
  }

  /**
   * Play the active element
   */
  async play(): Promise<void> {
    if (this.activeElement) {
      await this.activeElement.play();
    }
  }

  /**
   * Pause the active element
   */
  pause() {
    if (this.activeElement) {
      this.activeElement.pause();
    }
  }

  /**
   * Update pitch for all audio sources
   */
  setPitch(pitch: number) {
    this.currentPitch = getValidPitch(pitch);
  }

  /**
   * Get current pitch setting
   */
  getPitch(): number {
    return this.currentPitch;
  }

  /**
   * Clean up resources
   */
  destroy() {
    console.log("Destroying crossfade manager");

    this.cancelCrossfade();

    try {
      // Disconnect all nodes
      if (this.currentSource) {
        this.currentSource.source.disconnect();
        this.currentSource.gainNode.disconnect();
      }

      if (this.nextSource) {
        this.nextSource.source.disconnect();
        this.nextSource.gainNode.disconnect();
      }

      this.analyzerNode.disconnect();
      this.masterGain.disconnect();
    } catch (error) {
      console.error("Error during cleanup:", error);
    }

    this.currentSource = null;
    this.nextSource = null;
    this.activeElement = null;
  }
}
