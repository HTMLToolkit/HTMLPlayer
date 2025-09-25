/**
 * Crossfade Helper - Manages smooth audio transitions between songs
 * Uses Web Audio API for precise volume control and timing
 */

export interface CrossfadeOptions {
  duration: number; // Duration in seconds
  curve?: "linear" | "exponential" | "smooth"; // Fade curve type
}

export interface AudioSource {
  element: HTMLAudioElement;
  gainNode: GainNode;
  sourceNode: MediaElementAudioSourceNode;
}

export class CrossfadeManager {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private currentSource: AudioSource | null = null;
  private nextSource: AudioSource | null = null;
  private crossfadeInProgress = false;
  private crossfadeTimeout: number | null = null;
  private crossfadeStartTime: number | null = null;
  private crossfadePromise: Promise<void> | null = null;
  private currentEndedListener: (() => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.masterGainNode = audioContext.createGain();
    // Don't connect to destination here - will be connected with analyser in between
  }

  /**
   * Create an audio source with gain control
   */
  createAudioSource(audioElement: HTMLAudioElement): AudioSource {
    try {
      const sourceNode = this.audioContext.createMediaElementSource(audioElement);
      const gainNode = this.audioContext.createGain();

      sourceNode.connect(gainNode);
      gainNode.connect(this.masterGainNode);

      const audioSource = {
        element: audioElement,
        gainNode,
        sourceNode,
      };

      // Store reference to prevent creating multiple sources for same element
      (audioElement as any)._audioSource = audioSource;

      return audioSource;
    } catch (error) {
      // If the element is already connected to another source node, create a new element
      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        console.warn("CrossfadeManager: Audio element already connected, creating new element");
        const newAudioElement = new Audio();
        newAudioElement.crossOrigin = audioElement.crossOrigin;
        newAudioElement.src = audioElement.src;
        newAudioElement.currentTime = audioElement.currentTime;
        newAudioElement.volume = audioElement.volume;
        newAudioElement.playbackRate = audioElement.playbackRate;

        const sourceNode = this.audioContext.createMediaElementSource(newAudioElement);
        const gainNode = this.audioContext.createGain();

        sourceNode.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        return {
          element: newAudioElement,
          gainNode,
          sourceNode,
        };
      }
      throw error;
    }
  }

  /**
   * Set the current playing source
   */
  setCurrentSource(source: AudioSource) {
    if (this.currentSource !== source) {
      this.currentSource = source;
      // Make sure current source is at full volume
      this.currentSource.gainNode.gain.value = 1;
    }
  }

  /**
   * Prepare the next source for crossfading
   */
  prepareNextSource(source: AudioSource) {
    this.nextSource = source;
    // Start with zero volume for next source
    this.nextSource.gainNode.gain.value = 0;
  }

  /**
   * Start crossfade from current to next source with improved error handling
   */
  async startCrossfade(options: CrossfadeOptions): Promise<void> {
    if (!this.currentSource || !this.nextSource) {
      console.warn(
        "CrossfadeManager: Cannot start crossfade - missing sources:",
        {
          currentSource: !!this.currentSource,
          nextSource: !!this.nextSource,
        }
      );
      throw new Error("Cannot start crossfade - missing audio sources");
    }

    if (this.crossfadeInProgress) {
      console.warn(
        "CrossfadeManager: Crossfade already in progress, cancelling previous"
      );
      this.cancelCrossfade();
    }

    this.crossfadeInProgress = true;
    this.crossfadeStartTime = this.audioContext.currentTime;

    const { duration, curve = "smooth" } = options;
    const currentTime = this.audioContext.currentTime;

    // Create a promise that resolves when crossfade completes
    this.crossfadePromise = new Promise<void>(async (resolve, reject) => {
      try {
        // Ensure next audio element is ready
        if (this.nextSource!.element.readyState < 2) {
          console.log("CrossfadeManager: Waiting for next audio to load...");
          await new Promise<void>((loadResolve, loadReject) => {
            const timeout = setTimeout(() => {
              loadReject(new Error("Next audio failed to load in time"));
            }, 5000);

            const onCanPlay = () => {
              clearTimeout(timeout);
              this.nextSource!.element.removeEventListener(
                "canplay",
                onCanPlay
              );
              this.nextSource!.element.removeEventListener("error", onError);
              loadResolve();
            };

            const onError = () => {
              clearTimeout(timeout);
              this.nextSource!.element.removeEventListener(
                "canplay",
                onCanPlay
              );
              this.nextSource!.element.removeEventListener("error", onError);
              loadReject(new Error("Next audio failed to load"));
            };

            this.nextSource!.element.addEventListener("canplay", onCanPlay);
            this.nextSource!.element.addEventListener("error", onError);
          });
        }

        // Start playing the next source
        console.log("CrossfadeManager: Starting crossfade playback");
        await this.nextSource!.element.play();

        // Set up the crossfade curves based on curve type
        this.setupCrossfadeCurves(currentTime, duration, curve);

        // Listen for current song ending during crossfade
        this.currentEndedListener = () => {
          if (this.crossfadeInProgress) {
            console.log("CrossfadeManager: Current song ended during crossfade, completing early");
            this.clearCrossfadeTimeout();
            this.completeCrossfade();
            resolve();
          }
        };
        this.currentSource!.element.addEventListener("ended", this.currentEndedListener, { once: true });

        // Wait for crossfade to complete
        this.crossfadeTimeout = window.setTimeout(() => {
          if (this.crossfadeInProgress) {
            console.log("CrossfadeManager: Crossfade completed successfully");
            this.currentSource!.element.removeEventListener("ended", this.currentEndedListener!);
            this.currentEndedListener = null;
            this.completeCrossfade();
            resolve();
          }
        }, duration * 1000 + 100); // Add small buffer
      } catch (error) {
        console.error("CrossfadeManager: Crossfade failed:", error);
        // Clean up event listener
        if (this.currentEndedListener && this.currentSource) {
          this.currentSource.element.removeEventListener("ended", this.currentEndedListener);
          this.currentEndedListener = null;
        }
        this.crossfadeInProgress = false;
        this.clearCrossfadeTimeout();
        reject(error);
      }
    });

    return this.crossfadePromise;
  }

  /**
   * Set up crossfade curves based on the specified curve type
   */
  private setupCrossfadeCurves(
    currentTime: number,
    duration: number,
    curve: string
  ) {
    const currentGain = this.currentSource!.gainNode.gain;
    const nextGain = this.nextSource!.gainNode.gain;

    // Clear any existing automation
    currentGain.cancelScheduledValues(currentTime);
    nextGain.cancelScheduledValues(currentTime);

    switch (curve) {
      case "smooth":
        // Custom smooth curve using multiple segments for natural sound
        const segments = 10;
        const segmentDuration = duration / segments;

        currentGain.setValueAtTime(1, currentTime);
        nextGain.setValueAtTime(0.001, currentTime);

        for (let i = 1; i <= segments; i++) {
          const time = currentTime + i * segmentDuration;
          const progress = i / segments;

          // Smooth S-curve using sine function
          const fadeOutValue = Math.max(
            0.001,
            Math.cos((progress * Math.PI) / 2)
          );
          const fadeInValue = Math.sin((progress * Math.PI) / 2);

          currentGain.exponentialRampToValueAtTime(fadeOutValue, time);
          nextGain.exponentialRampToValueAtTime(fadeInValue, time);
        }
        break;

      case "exponential":
        currentGain.setValueAtTime(1, currentTime);
        currentGain.exponentialRampToValueAtTime(0.001, currentTime + duration);

        nextGain.setValueAtTime(0.001, currentTime);
        nextGain.exponentialRampToValueAtTime(1, currentTime + duration);
        break;

      case "linear":
        currentGain.setValueAtTime(1, currentTime);
        currentGain.linearRampToValueAtTime(0, currentTime + duration);

        nextGain.setValueAtTime(0, currentTime);
        nextGain.linearRampToValueAtTime(1, currentTime + duration);
        break;
    }
  }

  /**
   * Complete the crossfade transition
   */
  private completeCrossfade() {
    if (!this.crossfadeInProgress) return;

    try {
      // Stop and cleanup the previous source
      if (this.currentSource) {
        this.currentSource.element.pause();
        this.currentSource.element.currentTime = 0;
        // Ensure it's fully muted
        this.currentSource.gainNode.gain.cancelScheduledValues(
          this.audioContext.currentTime
        );
        this.currentSource.gainNode.gain.value = 0;
      }

      // Ensure next source is at full volume
      if (this.nextSource) {
        this.nextSource.gainNode.gain.cancelScheduledValues(
          this.audioContext.currentTime
        );
        this.nextSource.gainNode.gain.value = 1;
      }

      // Move next source to current
      this.currentSource = this.nextSource;
      this.nextSource = null;
      this.crossfadeInProgress = false;
      this.crossfadeStartTime = null;
      this.crossfadePromise = null;
      this.clearCrossfadeTimeout();

      console.log("CrossfadeManager: Crossfade transition completed");
    } catch (error) {
      console.error("CrossfadeManager: Error completing crossfade:", error);
      this.crossfadeInProgress = false;
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
   * Cancel an ongoing crossfade with proper cleanup
   */
  cancelCrossfade() {
    if (!this.crossfadeInProgress) return;

    console.log("CrossfadeManager: Cancelling crossfade");

    try {
      // Remove event listener if it exists
      if (this.currentEndedListener && this.currentSource) {
        this.currentSource.element.removeEventListener("ended", this.currentEndedListener);
        this.currentEndedListener = null;
      }

      // Cancel all scheduled changes
      this.currentSource?.gainNode.gain.cancelScheduledValues(
        this.audioContext.currentTime
      );
      this.nextSource?.gainNode.gain.cancelScheduledValues(
        this.audioContext.currentTime
      );

      // Reset volumes immediately
      if (this.currentSource) {
        this.currentSource.gainNode.gain.value = 1;
      }
      if (this.nextSource) {
        this.nextSource.gainNode.gain.value = 0;
        this.nextSource.element.pause();
        this.nextSource.element.currentTime = 0;
      }

      this.crossfadeInProgress = false;
      this.crossfadeStartTime = null;
      this.crossfadePromise = null;
      this.clearCrossfadeTimeout();
    } catch (error) {
      console.error("CrossfadeManager: Error cancelling crossfade:", error);
    }
  }

  /**
   * Get crossfade progress (0 to 1)
   */
  getCrossfadeProgress(): number {
    if (!this.crossfadeInProgress || !this.crossfadeStartTime) return 0;

    const elapsed = this.audioContext.currentTime - this.crossfadeStartTime;
    const duration = 3; // Default duration, could be stored
    return Math.min(1, Math.max(0, elapsed / duration));
  }

  /**
   * Set master volume with smooth transition
   */
  setMasterVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    // Smooth volume changes to prevent pops
    const currentTime = this.audioContext.currentTime;
    this.masterGainNode.gain.cancelScheduledValues(currentTime);
    this.masterGainNode.gain.setValueAtTime(
      this.masterGainNode.gain.value,
      currentTime
    );
    this.masterGainNode.gain.linearRampToValueAtTime(
      clampedVolume,
      currentTime + 0.1
    );
  }

  /**
   * Check if crossfade is currently active
   */
  isCrossfading(): boolean {
    return this.crossfadeInProgress;
  }

  /**
   * Get the master gain node for connecting analyzers
   */
  getMasterGainNode(): GainNode {
    return this.masterGainNode;
  }

  /**
   * Get the next audio element (if prepared)
   */
  getNextAudioElement(): HTMLAudioElement | null {
    return this.nextSource?.element || null;
  }

  /**
   * Get current volume levels for visualization
   */
  getVolumeLevels(): { current: number; next: number } {
    return {
      current: this.currentSource?.gainNode.gain.value || 0,
      next: this.nextSource?.gainNode.gain.value || 0,
    };
  }

  /**
   * Disconnect and cleanup resources
   */
  destroy() {
    console.log("CrossfadeManager: Destroying crossfade manager");

    this.cancelCrossfade();

    try {
      // Cleanup audio sources
      if (this.currentSource) {
        this.currentSource.sourceNode.disconnect();
        this.currentSource.gainNode.disconnect();
      }

      if (this.nextSource) {
        this.nextSource.sourceNode.disconnect();
        this.nextSource.gainNode.disconnect();
      }

      // Cleanup master gain
      this.masterGainNode.disconnect();
    } catch (error) {
      console.error("CrossfadeManager: Error during cleanup:", error);
    }

    this.currentSource = null;
    this.nextSource = null;
  }
}
